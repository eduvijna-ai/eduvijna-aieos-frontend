import type { TeacherNotesArtifact } from "./artifactTypes";

export function TeacherNotesRenderer({
  notes,
}: {
  notes: TeacherNotesArtifact;
}) {
  return (
    <article className="artifact-document" aria-label="Teacher Notes">
      <p className="artifact-kicker">Teacher Notes</p>
      <h2>{notes.title}</h2>
      <section className="artifact-section" aria-labelledby="artifact-notes-heading">
        <h3 id="artifact-notes-heading" className="sr-only">
          Notes
        </h3>
        <ul className="artifact-notes">
          {notes.notes.map((note, index) => (
            <li key={`note-${index}`}>{note}</li>
          ))}
        </ul>
      </section>
    </article>
  );
}
