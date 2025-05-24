import React, { useState } from 'react';
import FullWidthNumberField from './FullWidthInputField'; // 作成したコンポーネントをインポート
import { Box, Typography, Button, Container } from '@mui/material';
import { createTheme, ThemeProvider, CssBaseline } from '@mui/material';

// --- ライトモードとダークモードのテーマを定義 ---
const lightTheme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1976d2',
    },
    background: {
      default: '#f0f2f5', // 明るい背景色
      paper: '#ffffff',
    },
    text: {
      primary: '#212121', // 暗い文字色
    },
  },
});

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#90caf9',
    },
    background: {
      default: '#121212', // 暗い背景色
      paper: '#1d1d1d', // カードやコンポーネントの背景色
    },
    text: {
      primary: '#e0e0e0', // 明るい文字色
      secondary: '#bdbdbd',
    },
  },
});

function App() {
  // ユーザー設定やシステム設定に基づいてテーマを切り替えるロジック
  const [isDarkMode, setIsDarkMode] = useState(true); // 例: 初期はダークモード
  const currentTheme = isDarkMode ? darkTheme : lightTheme;

  // useStateのジェネリクスで型を明示 (string or number)
  const [price, setPrice] = useState<string>('');
  const [quantity, setQuantity] = useState<string>('');
  const [controlledAmount, setControlledAmount] = useState<string>('123');
  const [age, setAge] = useState<string>('');

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    alert(
      `送信された値:\n価格: ${price}\n数量: ${quantity}\n制御された値: ${controlledAmount}\n年齢: ${age}`
    );
    console.log('価格:', price);
    console.log('数量:', quantity);
    console.log('制御された値:', controlledAmount);
    console.log('年齢:', age);
  };

  return (
    <ThemeProvider theme={currentTheme}>
      {/* CssBaselineはMUIの推奨するCSSリセットとダークモードの背景色適用に役立つ */}
      <CssBaseline />
      <button onClick={() => setIsDarkMode(!isDarkMode)}>
        Toggle Theme ({isDarkMode ? 'Dark' : 'Light'})
      </button>

      <Container maxWidth="sm">
        <Box
          component="form"
          sx={{ '& .MuiTextField-root': { m: 1, width: '25ch' }, p: 3 }}
          noValidate
          autoComplete="off"
          onSubmit={handleSubmit}
        >
          <Typography variant="h5" gutterBottom>
            TypeScript版 全角数値入力フォームの例
          </Typography>

          {/* 価格入力フィールド */}
          <FullWidthNumberField
            label="価格"
            value={price}
            onValueChange={setPrice} // 変換後の値を受け取るカスタムプロパティ
            min={0}
            max={1_000_000} // タイプセーフな数値リテラル
            required
            name="price"
            placeholder="全角で価格を入力"
            helperText="0から1,000,000の範囲"
          />
          {/* 数量入力フィールド */}
          <FullWidthNumberField
            label="数量"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)} // TextField標準のonChangeも使用可能
            min={1}
            required
            name="quantity"
            sx={{ width: '15ch' }}
            helperText="1以上の値を入力"
          />
          {/* 年齢入力フィールド (整数のみ想定) */}
          <FullWidthNumberField
            label="年齢"
            value={age}
            onValueChange={setAge}
            min={0}
            max={120}
            name="age"
            placeholder="全角で年齢を入力"
            helperText="0から120の整数を入力"
            // 小数点を受け付けないようにするには、FullWidthNumberField.tsxのzenkakuToHankaku関数を修正
            // .replace(/[^0-9.]/g, ''); を .replace(/[^0-9]/g, ''); に変更
          />
          {/* 外部から値を制御する例 */}
          <FullWidthNumberField
            label="制御された金額"
            value={controlledAmount} // 親で値を完全に管理
            onValueChange={setControlledAmount}
            name="controlledAmount"
            placeholder="外部から値が設定"
            helperText="初期値が設定されており、ボタンで変更可能"
          />
          <Button variant="outlined" onClick={() => setControlledAmount('5000')} sx={{ mr: 1 }}>
            金額を5000に設定
          </Button>
          <Button variant="outlined" onClick={() => setControlledAmount('あ１２３')}>
            不正値を設定 (自動変換)
          </Button>
          <Button variant="outlined" onClick={() => setControlledAmount('')} sx={{ ml: 1 }}>
            クリア
          </Button>
        </Box>

        <Box sx={{ mt: 3 }}>
          <Button type="submit" variant="contained">
            送信
          </Button>
        </Box>

        <Typography variant="h6" sx={{ mt: 3 }}>
          現在のフォーム状態:
        </Typography>
        <Typography variant="body1">
          **価格**: `{price || '未入力'}` (型: {typeof price})
        </Typography>
        <Typography variant="body1">
          **数量**: `{quantity || '未入力'}` (型: {typeof quantity})
        </Typography>
        <Typography variant="body1">
          **制御された金額**: `{controlledAmount || '未入力'}` (型: {typeof controlledAmount})
        </Typography>
        <Typography variant="body1">
          **年齢**: `{age || '未入力'}` (型: {typeof age})
        </Typography>
      </Container>
    </ThemeProvider>
  );
}

export default App;
