import { useParams } from 'react-router-dom';
import { PagePlaceholder } from '../components/PagePlaceholder.jsx';

export default function Investigation() {
  const { id } = useParams();
  return (
    <PagePlaceholder title="Investigation room" eyebrow="Case in progress">
      <p className="font-mono">Case ID: {id}</p>
      <p className="mt-2">The story, suspects, clues and hints are built in T-15.</p>
    </PagePlaceholder>
  );
}
