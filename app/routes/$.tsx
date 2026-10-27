import type { MetaFunction } from 'react-router';
import { AppErrorPage } from '~/components/ui/AppErrorPage';
import { brandMeta } from '~/utils/brand';

export const meta: MetaFunction = () => brandMeta('Not found · Hypeable');

export default function NotFound() {
  return <AppErrorPage status={404} />;
}
