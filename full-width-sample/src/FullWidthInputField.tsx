import React, { useState, useCallback, useEffect, useRef } from 'react';
import type { TextFieldProps } from '@mui/material';
import { TextField } from '@mui/material';

// zenkakuToHankaku 関数はコンポーネントの外に定義
// 変換ロジックを、入力途中の可能性を考慮し、最低限の文字除去に留める。
// ここでは全角数字を半角に、そしてそれ以外の文字はそのまま保持します。
// マイナス記号や小数点もそのまま残すように変更します。
const zenkakuToHankaku = (input: string | number | null | undefined): string => {
  if (input === undefined || input === null) return '';
  const str = String(input);
  // 全角数字を半角に変換
  return str.replace(/[０-９]/g, (s) =>
    String.fromCharCode(s.charCodeAt(0) - 0xFEE0)
  );
  // ここで数字、小数点、マイナス記号以外の文字を除去しない。
  // それはバリデーションの役割。
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
   * TextFieldの標準onChangeイベントハンドラ。
   */
  onChange?: TextFieldProps['onChange'];
}

const FullWidthNumberField: React.FC<FullWidthNumberFieldProps> = ({
  value: controlledValue,
  onValueChange,
  min,
  max,
  label = '数値',
  placeholder = '全角数字も入力できます',
  onChange: muiOnChange,
  helperText: externalHelperText,
  ...restProps
}) => {
  // `internalValue`は常に半角確定後の値、またはIMEの未確定文字列（composition中のみ）を保持
  const [internalValue, setInternalValue] = useState<string>(() => {
    // 初期値もzenkakuToHankakuを通す
    return zenkakuToHankaku(controlledValue);
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
        const convertedValue = zenkakuToHankaku(controlledValue);
        // 現在のinternalValueと異なる場合のみ更新
        if (convertedValue !== internalValue) {
            setInternalValue(convertedValue);
            // 値が変更されたらバリデーションも再実行
            validateAndSetError(convertedValue);
        } else if ((controlledValue === null || controlledValue === undefined) && internalValue !== '') {
            // 親からの値がクリアされた場合、内部もクリア
            setInternalValue('');
            validateAndSetError('');
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
      // 例えば、'--' や '..', '1.2.3' のようなものは不正とする
      const isValidFormat = /^-?\d*(\.\d*)?$/.test(currentValue);

      if (!isValidFormat) {
          hasError = true;
          currentHelperText = '有効な半角数字、小数点、マイナス記号のみが許容されます。';
      } else {
        const numValue = Number(currentValue);
        // 数値に変換できない場合（例: "-", ".", "-." のみ）はエラーだが、入力途中として許容する
        if (isNaN(numValue)) {
            // ただし、もし有効な数値に変換できないが、かつ数値の形でない場合はエラー
            if (currentValue !== '-' && currentValue !== '.') {
              hasError = true;
              currentHelperText = '有効な半角数字を入力してください。';
            }
        }
        // 数値に変換できた場合の範囲チェック
        else { // !isNaN(numValue) の場合
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
    setError(hasError);
    setInternalHelperText(currentHelperText);
    return hasError; // バリデーション結果を返す
  }, [min, max, restProps.required]);

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
        // zenkakuToHankaku を適用し、確定値として扱う
        const hankakuValue = zenkakuToHankaku(inputValue);
        setInternalValue(hankakuValue); // 半角変換後の値を表示
        validateAndSetError(hankakuValue); // バリデーションを実行

        // 外部に変換後の値を通知
        if (onValueChange) {
            onValueChange(hankakuValue);
        }
        // TextFieldの標準onChangeも呼び出す
        if (muiOnChange) {
            muiOnChange({
                ...event,
                target: {
                    ...event.target,
                    value: hankakuValue, // 変換後の値をセットして渡す
                },
            });
        }
    }
  }, [onValueChange, muiOnChange, validateAndSetError]);

  return (
    <TextField
      label={label}
      placeholder={placeholder}
      value={internalValue} // composition中はIMEの未確定文字列、それ以外は半角確定文字列
      onChange={handleInternalChange}
      type="text" // 全角文字を受け入れるために'text'型を使用
      error={error}
      helperText={error ? internalHelperText : (externalHelperText || '全角数字も半角に変換されます。')}
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