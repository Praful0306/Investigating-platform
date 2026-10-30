import { useParams } from 'react-router-dom';
import { PagePlaceholder } from '../components/PagePlaceholder.jsx';

export default function Results() {
  const { id } = useParams();
  return (
    <PagePlaceholder title="Case result" eyebrow="Case closed">
      <p className="font-mono">Case ID: {id}</p>
      <p className="mt-2">The verdict, culprit and score breakdown are built in T-16.</p>
    </PagePlaceholder>
  );
}
