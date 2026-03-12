interface ContentPaneProps {
  children: React.ReactNode;
}

export function ContentPane({ children }: ContentPaneProps) {
  return (
    <main className="flex-1 min-h-0 bg-background overflow-hidden">
      {children}
    </main>
  );
}
