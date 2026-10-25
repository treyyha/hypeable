/**
 * Centered home hero. Aurora stays behind this block only.
 */
import { Aurora } from '~/components/ui/Aurora';

export function HomeHero() {
  return (
    <div id="intro" className="relative mx-auto mt-[10vh] max-w-2xl px-4 text-center lg:px-0">
      <Aurora />
      <h1 className="relative text-3xl font-semibold tracking-tight text-hype-text lg:text-5xl">
        What do you want to <span className="hype-gradient-text">build</span>?
      </h1>
      <p className="relative mt-3 text-sm text-hype-muted lg:text-base">worth the hype. Bring a key. Watch the cost.</p>
    </div>
  );
}
