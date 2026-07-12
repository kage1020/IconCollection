export type Collection = string;

export type License = string;

export type IconHit = {
  collection: string;
  name: string;
  license: string;
  width: number;
  height: number;
};

export type SearchQuery = {
  q: string;
  collection?: string[];
  license?: string[];
  limit?: number;
  cursor?: string;
};

export type SearchResponse = {
  hits: IconHit[];
  total: number;
  cursor: string | null;
};
