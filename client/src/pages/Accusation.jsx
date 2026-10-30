import { useParams } from 'react-router-dom';
import { PagePlaceholder } from '../components/PagePlaceholder.jsx';

export default function Accusation() {
  const { id } = useParams();
  return (
    <PagePlaceholder title="Make your accusation" eyebrow="Final answer">
      <p className="font-mono">Case ID: {id}</p>
      <p className="mt-2">The suspect picker is built in T-16.</p>
    </PagePlaceholder>
  );
}
