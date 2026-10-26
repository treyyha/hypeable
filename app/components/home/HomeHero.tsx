/**
 * Centered home heading. Aurora lives on the main column, not behind this block.
 */
export function HomeHero() {
  return (
    <div id="intro" className="relative z-[1] mx-auto mt-[8vh] max-w-[760px] px-4 text-center lg:px-0">
      <h1 className="hype-hero-heading mx-auto font-semibold text-hype-text">
        What do you want to <span className="hype-gradient-text">build</span>?
      </h1>
      <p className="mt-3 text-sm text-hype-muted lg:text-base">worth the hype. Bring a key. Watch the cost.</p>
    </div>
  );
}
