import { createGenerator, presetUno } from 'unocss';
import { describe, expect, it } from 'vitest';
import { mixCssVarAlpha, opacityFromSelector, varAlphaPostprocess } from './var-alpha';

describe('opacityFromSelector', () => {
  it('reads the escaped UnoCSS opacity suffix', () => {
    expect(opacityFromSelector('.bg-hype-accent\\/10')).toBe(10);
    expect(opacityFromSelector('.hover\\:border-hype-accent\\/50:hover')).toBe(50);
    expect(opacityFromSelector('.bg-hype-accent')).toBeNull();
    expect(opacityFromSelector('.bg-hype-accent\\/100')).toBeNull();
  });
});

describe('mixCssVarAlpha', () => {
  it('rewrites CSS-variable colors to color-mix and leaves hex rgb() alone', () => {
    expect(mixCssVarAlpha('.bg-hype-accent\\/10', [['background-color', 'var(--hype-accent)']])).toEqual([
      ['background-color', 'color-mix(in srgb, var(--hype-accent) 10%, transparent)'],
    ]);

    expect(mixCssVarAlpha('.bg-black\\/70', [['background-color', 'rgb(0 0 0 / 0.7)']])).toEqual([
      ['background-color', 'rgb(0 0 0 / 0.7)'],
    ]);
  });

  it('rewrites gradient stops that keep a position var after the color', () => {
    expect(
      mixCssVarAlpha('.from-hype-accent\\/8', [
        ['--un-gradient-from', 'var(--hype-accent) var(--un-gradient-from-position)'],
      ]),
    ).toEqual([
      ['--un-gradient-from', 'color-mix(in srgb, var(--hype-accent) 8%, transparent) var(--un-gradient-from-position)'],
    ]);
  });
});

describe('varAlphaPostprocess', () => {
  it('makes UnoCSS emit color-mix for hype and bolt variable opacities', async () => {
    const uno = await createGenerator({
      presets: [presetUno({ preflight: false })],
      theme: {
        colors: {
          hype: { accent: 'var(--hype-accent)', bg: 'var(--hype-bg)' },
          bolt: { elements: { borderColor: 'var(--bolt-elements-borderColor)' } },
        },
      },
      postprocess: varAlphaPostprocess,
    });

    const { css } = await uno.generate(
      'bg-hype-accent/10 bg-hype-bg/70 hover:border-hype-accent/50 bg-bolt-elements-borderColor/30 bg-green-500/10',
    );

    expect(css).toContain('color-mix(in srgb, var(--hype-accent) 10%, transparent)');
    expect(css).toContain('color-mix(in srgb, var(--hype-bg) 70%, transparent)');
    expect(css).toContain('color-mix(in srgb, var(--bolt-elements-borderColor) 30%, transparent)');
    expect(css).toContain('rgb(34 197 94 / 0.1)');
    expect(css).not.toMatch(/\.bg-hype-accent\\\/10\{background-color:var\(--hype-accent\)\}/);
  });
});
