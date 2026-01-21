import { AppRouter } from './router';
// 导入 themeStore 确保主题在应用启动时初始化
import './stores/themeStore';

function App() {
  return <AppRouter />;
}

export default App;
