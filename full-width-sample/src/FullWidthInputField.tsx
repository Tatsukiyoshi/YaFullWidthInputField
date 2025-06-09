import React, { useState, useCallback, useEffect, useRef } from 'react';
import type { TextFieldProps } from '@mui/material';
import { TextField } from '@mui/material';

// 入力値を正規化する関数 (全角→半角、カンマ除去)
// 変換ロジックを、入力途中の可能性を考慮し、最低限の文字除去に留める。
// 全角数字を半角に、そしてそれ以外の文字はそのまま保持（ただしカンマは除去）。
// マイナス記号や小数点もそのまま残すように変更します。
const normalizeAndRemoveCommas = (input: string | number | null | undefined): string => {
  if (input === undefined || input === null) return '';
  let str = String(input);
  // 全角数字を半角に変換
  str = str.replace(/[０-９]/g, (s) =>
    String.fromCharCode(s.charCodeAt(0) - 0xFEE0)
  );
  // 全角ピリオドを半角ピリオドに変換
  str = str.replace(/．/g, '.');
  // 全角マイナスを半角マイナスに変換
  str = str.replace(/ー/g, '-');
  // カンマを除去
  str = str.replace(/,/g, '');
  return str;
  // ここで数字、小数点、マイナス記号以外の文字を除去しない。
  // それはバリデーションの役割。
};

// 数値をカンマ区切り文字列にフォーマットする関数
const formatNumberWithCommas = (
  value: string,
  allowDecimal: boolean,
  decimalPlaces?: number
): string => {
  if (value === null || value === undefined) return '';
  const valStr = String(value);

  if (valStr === '' || valStr === '-' || valStr === '.' || valStr === '-.') return valStr;

  const num = Number(valStr);

  if (isNaN(num)) {
    // Number() で NaN になるが、部分的にフォーマット可能な場合 (例: "123invalid")
    // 基本的にはバリデーションでエラーになるはず。
    const parts = valStr.split('.');
    const integerPart = parts[0];
    const potentialDecimalPart = parts.length > 1 ? parts[1] : undefined;
    const intNumCheck = Number(integerPart);
    if (integerPart !== '' && !isNaN(intNumCheck)) {
      let formattedInt = Number(integerPart).toLocaleString('en-US', { maximumFractionDigits: 0 });
      if (allowDecimal && potentialDecimalPart !== undefined) {
        return `${formattedInt}.${potentialDecimalPart}`;
      }
      return formattedInt;
    }
    return valStr; // フォーマット不能ならそのまま
  }

  // 有効な数値の場合
  const options: Intl.NumberFormatOptions = {};
  if (!allowDecimal) {
    options.minimumFractionDigits = 0;
    options.maximumFractionDigits = 0;
  } else {
    if (decimalPlaces !== undefined) {
      options.minimumFractionDigits = decimalPlaces;
      options.maximumFractionDigits = decimalPlaces;
    } else {
      const decimalPartStr = valStr.split('.')[1];
      if (decimalPartStr) {
        options.minimumFractionDigits = decimalPartStr.length;
        options.maximumFractionDigits = decimalPartStr.length;
      } else {
        options.minimumFractionDigits = 0;
        options.maximumFractionDigits = 0;
      }
    }
  }
  return num.toLocaleString('en-US', options);
};

// FullWidthNumberFieldに独自のPropsを追加するための型定義
// TextFieldPropsをOmitすることで、TextFieldのvalueとonChangeが
// カスタムプロパティによって上書きされるのを防ぎつつ、他のTextFieldのPropsを継承します。
interface FullWidthNumberFieldProps extends Omit<TextFieldProps, 'value' | 'onChange' | 'type'> {
  /**
   * コンポーネントが制御する現在の値。半角数字の文字列として扱われます。
   * 外部から初期値を設定したり、値を更新したりするために使用します。
   */
  value?: string | number | null;
  /**
   * 値が変更されたときに呼び出されるコールバック関数。
   * 引数には半角数字に変換された文字列値が渡されます。
   */
  onValueChange?: (value: string) => void;
  /**
   * 許容される数値の最小値。
   */
  min?: number;
  /**
   * 許容される数値の最大値。
   */
  max?: number;
  /**
   * 小数点の入力を許可するかどうか。デフォルトはtrue。
   * falseの場合、整数のみが許可されます。
   */
  allowDecimal?: boolean;
  /**
   * 許可される小数点以下の最大桁数。allowDecimalがtrueの場合にのみ有効。
   */
  decimalPlaces?: number;
  /**
   * TextFieldの標準onChangeイベントハンドラ。
   */
  onChange?: TextFieldProps['onChange'];
  /**
   * TextFieldの標準onBlurイベントハンドラ。
   */
  onBlur?: TextFieldProps['onBlur']
}

const FullWidthNumberField: React.FC<FullWidthNumberFieldProps> = ({
  value: controlledValue,
  onValueChange,
  min,
  max,
  allowDecimal = true, // デフォルトで小数を許可
  decimalPlaces,
  label = '数値',
  placeholder = '全角数字も入力できます',
  onChange: muiOnChange,
  onBlur: muiOnBlur, // muiOnBlur を props から受け取る
  helperText: externalHelperText,
  ...restProps
}) => {
  // `internalValue`は常に半角確定後の値、またはIMEの未確定文字列（composition中のみ）を保持
  const [internalValue, setInternalValue] = useState<string>(() => {
    return normalizeAndRemoveCommas(controlledValue); // 初期値も正規化
  });
  const [error, setError] = useState<boolean>(false);
  const [internalHelperText, setInternalHelperText] = useState<string>('');

  // IMEのcomposition（変換中）状態を追跡するフラグ
  const isComposing = useRef(false);

  // controlledValue (親からの値) の変更を監視し、内部状態を同期
  useEffect(() => {
    // IME変換中ではない場合、親から渡された値を正規化して内部状態を更新
    // Composition中はIMEがDOMを制御するため、更新を控える
    if (!isComposing.current) {
      const normalized = normalizeAndRemoveCommas(controlledValue);
      // 現在のinternalValueと異なる場合のみ更新
      if (normalized !== internalValue) {
          setInternalValue(normalized);
          // 値が変更されたらバリデーションも再実行
          validateAndSetError(normalized);
      }
    }
  }, [controlledValue]); // internalValue を依存配列から外すことで無限ループを避ける

  // バリデーションロジックを分離
  const validateAndSetError = useCallback((currentValue: string) => {
    let hasError: boolean = false;
    let currentHelperText: string = '';

    // 必須入力チェック
    if (restProps.required && currentValue === '') {
      hasError = true;
      currentHelperText = '入力は必須です。';
    } else if (currentValue !== '') {
      // 半角数字、小数点、先頭のマイナス記号のみを許容する正規表現
      const patternStr = allowDecimal ? `^-?\\d*(\\.\\d*)?$` : `^-?\\d*$`;
      const isValidNumericFormat = new RegExp(patternStr).test(currentValue);
      
      if (!isValidNumericFormat) {
        hasError = true;
        currentHelperText = allowDecimal
          ? '有効な半角数字、小数点、マイナス記号のみが許容されます。'
          : '有効な半角整数、マイナス記号のみが許容されます。';
      } else {
        // 入力途中として許容するパターン: "-", ".", "-." (allowDecimal時のみ)
        const isInputInProgress = currentValue === '-' ||
                                 (allowDecimal && (currentValue === '.' || currentValue === '-.'));

        if (isInputInProgress) {
          // No error, input is in progress
        } else {
          const numValue = Number(currentValue);
          if (isNaN(numValue)) {
            // このパスは isValidNumericFormat のチェックにより通常は到達しないはず
            hasError = true;
            currentHelperText = '有効な半角数字を入力してください。';
          } else { // !isNaN(numValue) の場合
            if (allowDecimal && decimalPlaces !== undefined) {
              const parts = currentValue.split('.');
              if (parts.length > 1 && parts[1].length > decimalPlaces) {
                hasError = true;
                currentHelperText = `小数点以下は${decimalPlaces}桁までです。`;
              }
            }
            // 桁数エラーがない場合のみ範囲チェック
            if (!hasError) {
              if (min !== undefined && numValue < min) {
                  hasError = true;
                  currentHelperText = `${min}以上の値を入力してください。`;
              }
              if (max !== undefined && numValue > max) {
                  hasError = true;
                  currentHelperText = `${max}以下の値を入力してください。`;
              }
            }
          }
        }
      }
    }
    setError(hasError);
    setInternalHelperText(currentHelperText);
    return hasError; // バリデーション結果を返す
  }, [min, max, restProps.required, allowDecimal, decimalPlaces]);

    // input要素のonBlurイベントハンドラ
  const handleInternalBlur = useCallback((event: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (!isComposing.current) {
      const currentValue = internalValue;
      // まず現在の値でバリデーションを再実行し、エラー状態を最新にする
      const hasErrorFromValidation = validateAndSetError(currentValue);

      // エラーがなく、かつ小数が許可されていて、小数点以下の桁数指定がある場合のみ丸め処理を行う
      // allowDecimal === false の場合は、ここでの丸め処理は行わない。
      // バリデーションでエラーになっていれば、そのエラー状態が維持される。
      if (!hasErrorFromValidation && allowDecimal && decimalPlaces !== undefined) {
        const numValue = Number(currentValue);
        // 有効な数値の場合のみ丸める (入力途中の "-", "." は除外)
        if (!isNaN(numValue) && currentValue !== '' && currentValue !== '-' && currentValue !== '.') {
          const roundedValue = numValue.toFixed(decimalPlaces);
          if (roundedValue !== currentValue) {
            setInternalValue(roundedValue);
            // 丸め後の値で再度バリデーション（主に表示のため、エラーは発生しない想定）
            validateAndSetError(roundedValue);
            if (onValueChange) {
              onValueChange(roundedValue);
            }
          }
        }
      }
    }
    // 外部のonBlurプロパティがあれば呼び出す
    if (muiOnBlur) {
      muiOnBlur(event);
    }
  }, [internalValue, onValueChange, validateAndSetError, allowDecimal, decimalPlaces, muiOnBlur]);

  // input要素のonChangeイベントハンドラ
  const handleInternalChange = useCallback((event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const inputValue = event.target.value;

    // composition中は、IMEがDOMを直接操作するため、Reactのstateは更新しない
    if (isComposing.current) {
      // IMEが未確定文字列を表示している間は、その値をそのままinternalValueにセットし、
      // Reactの再レンダリングをトリガーしてIMEの入力バッファがクリアされないようにする。
      // ただし、この時のinternalValueは「未確定文字列」なので、バリデーションは行わない。
      setInternalValue(inputValue);
      // 外部のonChangeも必要な場合は呼び出す（IMEによる未確定文字列を渡す）
      if (muiOnChange) {
        muiOnChange(event);
      }
    } else {
      // composition中ではない場合（直接入力、コピペ、composition確定後など）
      // 入力値を正規化 (全角->半角、カンマ除去)
      const normalizedValue = normalizeAndRemoveCommas(inputValue);
      setInternalValue(normalizedValue);
      validateAndSetError(normalizedValue); // バリデーションを実行

      // 外部に変換後の値を通知
      if (onValueChange) {
          onValueChange(normalizedValue);
      }
      // TextFieldの標準onChangeも呼び出す
      if (muiOnChange) {
          muiOnChange({
              ...event,
              target: {
                  ...event.target,
                  value: normalizedValue, // 変換後の値をセットして渡す
              },
          });
      }
    }
  }, [onValueChange, muiOnChange, validateAndSetError]);

  // 表示用の値。IME入力中は internalValue (未確定文字列、カンマ含む可能性あり) をそのまま使い、
  // エラーが発生している場合も、フォーマットせずに元の入力値を表示する
  // それ以外の場合は internalValue (カンマなし確定文字列) をフォーマットする。
  const displayValue = (isComposing.current || error)
    ? internalValue // IME入力中またはエラー時はそのまま表示
    : formatNumberWithCommas(internalValue, allowDecimal, decimalPlaces);

  const defaultHelperText = allowDecimal ? '全角数字も半角に変換されます。' : '全角整数も半角に変換されます。';

  return (
    <TextField
      label={label}
      placeholder={placeholder}
      value={displayValue} // フォーマットされた値を表示
      onChange={handleInternalChange}
      onBlur={handleInternalBlur} // Blurイベントハンドラを追加
      type="text" // 全角文字を受け入れるために'text'型を使用
      error={error}
      helperText={error ? internalHelperText : (externalHelperText || defaultHelperText)}
      // IME compositionイベントハンドラ
      onCompositionStart={() => { isComposing.current = true; }}
      onCompositionEnd={(event) => {
        isComposing.current = false; // composition終了フラグをfalseに

        // compositionが終了した際に、最終的な確定値を処理
        // handleInternalChange を再度呼び出すことで、確定後の値での変換・バリデーション・通知を行う
        // この時、event.target.value はIMEによって確定された最終的な文字列になっている
        handleInternalChange(event as unknown as React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>);
      }}
      {...restProps}
      inputProps={{
        ...restProps.inputProps
      }}
    />
  );
};

export default FullWidthNumberField;