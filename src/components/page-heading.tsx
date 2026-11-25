import { sections } from "../features/navigation";

export function PageHeading({
  section,
  children,
}: {
  section: string;
  children?: React.ReactNode;
}) {
  const page = sections.find(({ id }) => id === section);
  if (!page) return null;
  return (
    <div className="page-heading">
      <div>
        <h1>{page.title}</h1>
        <p>{page.description}</p>
      </div>
      {children}
    </div>
  );
}
