import './globals.css';
export const metadata = {
  title: '月下疑局 · AI 狼人杀',
  description: '月夜中的九人文字推理对局，自定义 AI 性格。',
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
