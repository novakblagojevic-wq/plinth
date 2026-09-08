export interface Size { w: number; h: number }
export type FitMode = 'contain' | 'cover';
export interface ImageMeta {
  width: number;
  height: number;
  originalWidth: number;
  originalHeight: number;
  cap: number;
  downscaled: boolean;
  identity: 'demo' | 'user';
}
export interface ImageState extends ImageMeta {
  fit: FitMode;
  pad: number;
  padColor: string;
}
