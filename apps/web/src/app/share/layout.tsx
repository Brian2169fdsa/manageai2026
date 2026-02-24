// Public share layout — NO auth, NO sidebar, NO navigation.
// Share pages are fully public and standalone.
export default function ShareLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0, background: '#fff' }}>
        {children}
      </body>
    </html>
  );
}
