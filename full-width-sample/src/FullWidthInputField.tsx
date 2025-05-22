import React, { useState, useCallback, useEffect } from 'react';
import type { TextFieldProps } from '@mui/material';
import { TextField } from '@mui/material';

// --- zenkakuToHankaku 関数をコンポーネントの外に定義 ---
/**
 * 全角数字を半角数字に変換し、数字と小数点以外の文字を削除するヘルパー関数。
 * @param {string | number | null | undefined} input - 変換対象の値。
 * @returns {string} 半角数字のみを含む文字列。
 */
const zenkakuToHankaku = (input: string | number | null | undefined): string => {
  if (input === undefined || input === null) return '';
  const str = String(input); // 入力を必ず文字列に変換
  return str.replace(/[０-９]/g, (s) =>
    String.fromCharCode(s.charCodeAt(0) - 0xFEE0)
  ).replace(/[^0-9.]/g, ''); // 数字と小数点以外を削除（小数点も許容する場合）
  // 小数点を許容しない場合は .replace(/[^0-9]/g, '');
};
// --- ここまで ---


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

/**
 * 全角数字の入力を受け付け、半角数字に変換して表示するMUI TextFieldコンポーネント。
 * 入力値の変換と基本的な数値バリデーションを内包します。
 */
const FullWidthNumberField: React.FC<FullWidthNumberFieldProps> = ({
  value: controlledValue, // 親から渡される制御された値
  onValueChange,
  min,
  max,
  label = '数値',
  placeholder = '全角数字も入力できます',
  onChange: muiOnChange, // TextFieldの標準onChangeは必要に応じて受け取る
  helperText: externalHelperText, // 外部から指定されるhelperText
  ...restProps
}) => {
  // 内部状態：TextFieldに表示される値（常に半角）
  const [internalValue, setInternalValue] = useState<string>(() => {
    // ここで直接 zenkakuToHankaku を呼び出す
    return zenkakuToHankaku(String(controlledValue));
  });
  const [error, setError] = useState<boolean>(false);
  const [internalHelperText, setInternalHelperText] = useState<string>('');

  // 親の controlledValue が変更された場合に internalValue を同期
  // これにより、親コンポーネントから値を外部的にリセットまたは変更できます。
  useEffect(() => {
    // ここでも直接 zenkakuToHankaku を呼び出す
    const convertedValue = zenkakuToHankaku(controlledValue);
    if (convertedValue !== internalValue) {
      setInternalValue(convertedValue);
      // controlledValueが変更された際にバリデーションも再実行
      validateAndSetError(convertedValue);
    }
  }, [controlledValue, internalValue, min, max, restProps.required]); // バリデーションに関連する依存関係を追加
  
  // バリデーションロジックを分離したヘルパー関数
  const validateAndSetError = useCallback((currentValue: string) => {
    let hasError: boolean = false;
    let currentHelperText: string = '';

    if (restProps.required && currentValue === '') {
      hasError = true;
      currentHelperText = '入力は必須です。';
    } else if (currentValue !== '') {
      const numValue = Number(currentValue);
      if (isNaN(numValue)) {
        hasError = true;
        currentHelperText = '有効な半角数字を入力してください。';
      } else if (min !== undefined && numValue < min) {
        hasError = true;
        currentHelperText = `${min}以上の値を入力してください。`;
      } else if (max !== undefined && numValue > max) {
        hasError = true;
        currentHelperText = `${max}以下の値を入力してください。`;
      }
    }
    setError(hasError);
    setInternalHelperText(currentHelperText);
    return hasError; // バリデーション結果を返す
  }, [min, max, restProps.required]);

  const handleInternalChange = useCallback((event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const inputValue = event.target.value;
    const hankakuValue = zenkakuToHankaku(inputValue); // ここでも呼び出す

    setInternalValue(hankakuValue); // 表示値を半角に更新

    // バリデーションを実行
    const hasError = validateAndSetError(hankakuValue);

    // 親コンポーネントに変換後の値を通知
    if (onValueChange) {
      onValueChange(hankakuValue);
    }

    if (muiOnChange) {
      muiOnChange({
        ...event,
        target: {
          ...event.target,
          value: hankakuValue,
        },
      });
    }
  }, [onValueChange, muiOnChange, validateAndSetError]); // zenkakuToHankaku は依存配列から除外（外部定義のため）

  return (
    <TextField
      label={label}
      placeholder={placeholder}
      value={internalValue}
      onChange={handleInternalChange}
      type="text"
      error={error}
      helperText={error ? internalHelperText : (externalHelperText || '全角数字も半角に変換されます。')}
      {...restProps}
      inputProps={{
        ...restProps.inputProps
      }}
    />
  );
};
export default FullWidthNumberField;
