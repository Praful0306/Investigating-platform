import { Link } from 'react-router-dom';
import { Button } from '../components/ui/Button.jsx';
import { PagePlaceholder } from '../components/PagePlaceholder.jsx';

export default function NotFound() {
  return (
    <PagePlaceholder title="Page not found" eyebrow="Error 404">
      <p>That page does not exist, or the case file has been moved.</p>
      <Button as={Link} to="/" className="mt-6">Back to the home page</Button>
    </PagePlaceholder>
  );
}
