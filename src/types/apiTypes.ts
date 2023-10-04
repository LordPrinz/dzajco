export type CreateRequest = {
  url: string;
  customName?: string;
  expire?: string;
};

export type DeleteRequest = {
  secretKey: string | null;
};
