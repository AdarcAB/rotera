export type FeatureRow = {
  id: number;
  title: string;
  description: string | null;
  status: string;
  votes: number;
  myVote: boolean;
  createdByUserId: number | null;
  createdAt: string;
};
