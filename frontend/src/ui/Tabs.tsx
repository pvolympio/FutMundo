/** Abas de navegação em texto */
export function Tabs<T extends string = string>({
  tabs,
  activeTab,
  onChange,
  className,
}: {
  tabs: Array<{ id: T; label: string }>;
  activeTab: T;
  onChange: (id: T) => void;
  className?: string;
}) {
  return (
    <nav className={`tabs ${className || ''}`}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`tab ${activeTab === tab.id ? 'active' : ''}`}
        >
          {tab.label}
          {activeTab === tab.id && <div className="tab-underline" />}
        </button>
      ))}
    </nav>
  );
}