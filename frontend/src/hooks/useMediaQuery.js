/**
 * Hooks de media query para responsividade.
 *
 * Use `useMediaQuery` para consultas arbitrárias e `useIsMobile`
 * para o breakpoint mobile padrão (<= 768px).
 *
 * Exemplos:
 *   const isMobile = useIsMobile();
 *   const isTablet = useMediaQuery('(max-width: 1024px)');
 *   const isDesktop = useMediaQuery('(min-width: 1025px)');
 */

import { useState, useEffect } from 'react';
import tokens from '../styles/tokens.module.css';

export const BREAKPOINTS = {
  xs: parseInt(tokens.breakpointXs, 10),
  sm: parseInt(tokens.breakpointSm, 10),
  md: parseInt(tokens.breakpointMd, 10),
  lg: parseInt(tokens.breakpointLg, 10),
  xl: parseInt(tokens.breakpointXl, 10),
  xxl: parseInt(tokens.breakpointXxl, 10),
};

/**
 * Observa uma media query do CSS e retorna true/false.
 */
export function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const media = window.matchMedia(query);
    const listener = (event) => setMatches(event.matches);

    // matchMedia moderno
    if (media.addEventListener) {
      media.addEventListener('change', listener);
    } else {
      // fallback para navegadores antigos
      media.addListener(listener);
    }

    setMatches(media.matches);

    return () => {
      if (media.removeEventListener) {
        media.removeEventListener('change', listener);
      } else {
        media.removeListener(listener);
      }
    };
  }, [query]);

  return matches;
}

/**
 * Retorna true quando a largura da viewport é menor ou igual ao breakpoint mobile (768px).
 */
export function useIsMobile() {
  return useMediaQuery(`(max-width: ${BREAKPOINTS.md}px)`);
}

/**
 * Retorna true quando a largura da viewport é menor ou igual ao breakpoint tablet (1024px).
 */
export function useIsTabletOrSmaller() {
  return useMediaQuery(`(max-width: ${BREAKPOINTS.lg}px)`);
}

/**
 * Retorna true quando a largura da viewport é menor ou igual ao breakpoint sm (640px).
 * Útil para ativar card-view em tabelas.
 */
export function useIsSmallScreen() {
  return useMediaQuery(`(max-width: ${BREAKPOINTS.sm}px)`);
}

/**
 * Retorna o nome do breakpoint ativo.
 * Pode ser usado para lógica condicional, mas prefira useMediaQuery para layout puro.
 */
export function useBreakpoint() {
  const isXs = useMediaQuery(`(max-width: ${BREAKPOINTS.xs}px)`);
  const isSm = useMediaQuery(`(max-width: ${BREAKPOINTS.sm}px)`);
  const isMd = useMediaQuery(`(max-width: ${BREAKPOINTS.md}px)`);
  const isLg = useMediaQuery(`(max-width: ${BREAKPOINTS.lg}px)`);
  const isXl = useMediaQuery(`(max-width: ${BREAKPOINTS.xl}px)`);

  if (isXs) return 'xs';
  if (isSm) return 'sm';
  if (isMd) return 'md';
  if (isLg) return 'lg';
  if (isXl) return 'xl';
  return 'xxl';
}
