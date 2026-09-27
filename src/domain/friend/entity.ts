export type FriendshipStatus = 'pending' | 'accepted' | 'blocked';

export interface Friendship {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: FriendshipStatus;
  created_at: Date;
  updated_at: Date;
}

export interface FriendResponse {
  user_id: string;
  username: string;
  fullname: string;
  status: string;
  created_at: Date;
}
