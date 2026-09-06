/**
 * Configuração de como um arquivo é apresentado em um quadro específico.
 * Ela pertence ao uso da mídia no conteúdo e nunca ao arquivo da biblioteca.
 */
export interface MediaFocalPoint {
  /** Percentual horizontal do ponto que deve permanecer visível (0 a 100). */
  x: number;
  /** Percentual vertical do ponto que deve permanecer visível (0 a 100). */
  y: number;
}

export interface VideoPlaybackRange {
  /** Segundo de início do trecho, contado a partir do começo do arquivo. */
  startSeconds: number;
  /**
   * Duração do trecho em segundos. Ausente significa reproduzir até o fim do vídeo.
   */
  durationSeconds?: number;
}

export interface MediaPlacement {
  focalPoint: MediaFocalPoint;
  /** Válido exclusivamente quando a mídia daquele uso é um vídeo. */
  playback?: VideoPlaybackRange;
}

/**
 * O celular herda integralmente o desktop quando `mobile` não é informado.
 * Quando necessário, `mobile` substitui o ponto focal e/ou trecho apenas daquele quadro.
 */
export interface ResponsiveMediaPresentation {
  desktop: MediaPlacement;
  mobile?: MediaPlacement;
}

/**
 * Derivadas públicas opcionais de uma imagem da biblioteca. Conteúdo legado
 * continua válido somente com `src`; as dimensões das derivadas permitem que
 * o navegador escolha um arquivo sem adivinhar a largura descrita no srcset.
 */
export interface ResponsiveImageSources {
  width?: number;
  height?: number;
  thumbnailUrl?: string;
  thumbnailWidth?: number;
  thumbnailHeight?: number;
  mediumUrl?: string;
  mediumWidth?: number;
  mediumHeight?: number;
  largeUrl?: string;
  largeWidth?: number;
  largeHeight?: number;
}
