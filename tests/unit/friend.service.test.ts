import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SendRequestService } from '../../src/application/friend/send_request.service.js';
import { AcceptFriendService } from '../../src/application/friend/accept.service.js';
import { RejectFriendService } from '../../src/application/friend/reject.service.js';
import { RemoveFriendService } from '../../src/application/friend/remove.service.js';
import { ListFriendsService } from '../../src/application/friend/list_friends.service.js';
import { ListPendingFriendsService } from '../../src/application/friend/list_pending.service.js';
import {
  CannotFriendSelfError,
  FriendshipAlreadyExistsError,
  FriendshipNotFoundError,
  FriendshipForbiddenError,
} from '../../src/domain/friend/errors.js';
import { FriendRepository } from '../../src/domain/friend/repository.js';
import { Friendship, FriendResponse } from '../../src/domain/friend/entity.js';

describe('Friend Application Services', () => {
  let mockFriendRepo: FriendRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    mockFriendRepo = {
      create: vi.fn(),
      exists: vi.fn(),
      updateStatus: vi.fn(),
      delete: vi.fn(),
      listFriends: vi.fn(),
      listPendingIncoming: vi.fn(),
      getById: vi.fn(),
    };
  });

  describe('SendRequestService', () => {
    it('should throw CannotFriendSelfError when requester and addressee are the same', async () => {
      const service = new SendRequestService(mockFriendRepo);
      await expect(service.execute('user-1', 'user-1')).rejects.toThrow(CannotFriendSelfError);
      expect(mockFriendRepo.exists).not.toHaveBeenCalled();
      expect(mockFriendRepo.create).not.toHaveBeenCalled();
    });

    it('should throw FriendshipAlreadyExistsError when friendship already exists', async () => {
      vi.mocked(mockFriendRepo.exists).mockResolvedValue(true);
      const service = new SendRequestService(mockFriendRepo);

      await expect(service.execute('user-1', 'user-2')).rejects.toThrow(FriendshipAlreadyExistsError);
      expect(mockFriendRepo.exists).toHaveBeenCalledWith('user-1', 'user-2');
      expect(mockFriendRepo.create).not.toHaveBeenCalled();
    });

    it('should successfully create friendship request when not exists', async () => {
      const expectedFriendship: Friendship = {
        id: 'f-123',
        requester_id: 'user-1',
        addressee_id: 'user-2',
        status: 'pending',
        created_at: new Date(),
        updated_at: new Date(),
      };
      vi.mocked(mockFriendRepo.exists).mockResolvedValue(false);
      vi.mocked(mockFriendRepo.create).mockResolvedValue(expectedFriendship);

      const service = new SendRequestService(mockFriendRepo);
      const result = await service.execute('user-1', 'user-2');

      expect(mockFriendRepo.exists).toHaveBeenCalledWith('user-1', 'user-2');
      expect(mockFriendRepo.create).toHaveBeenCalledWith('user-1', 'user-2');
      expect(result).toEqual(expectedFriendship);
    });
  });

  describe('AcceptFriendService', () => {
    it('should update status to accepted for the acting user', async () => {
      const expectedFriendship: Friendship = {
        id: 'f-123',
        requester_id: 'user-1',
        addressee_id: 'user-2',
        status: 'accepted',
        created_at: new Date(),
        updated_at: new Date(),
      };
      vi.mocked(mockFriendRepo.updateStatus).mockResolvedValue(expectedFriendship);

      const service = new AcceptFriendService(mockFriendRepo);
      const result = await service.execute('f-123', 'user-2');

      expect(mockFriendRepo.updateStatus).toHaveBeenCalledWith('f-123', 'accepted', 'user-2');
      expect(result).toEqual(expectedFriendship);
    });

    it('should propagate FriendshipNotFoundError if repo throws not found', async () => {
      vi.mocked(mockFriendRepo.updateStatus).mockRejectedValue(new FriendshipNotFoundError());

      const service = new AcceptFriendService(mockFriendRepo);
      await expect(service.execute('f-nonexistent', 'user-2')).rejects.toThrow(FriendshipNotFoundError);
    });

    it('should propagate FriendshipForbiddenError if user is not addressee', async () => {
      vi.mocked(mockFriendRepo.updateStatus).mockRejectedValue(new FriendshipForbiddenError());

      const service = new AcceptFriendService(mockFriendRepo);
      await expect(service.execute('f-123', 'unauthorized-user')).rejects.toThrow(FriendshipForbiddenError);
    });
  });

  describe('RejectFriendService', () => {
    it('should call repo.delete with friendship id and acting user id', async () => {
      vi.mocked(mockFriendRepo.delete).mockResolvedValue(undefined);

      const service = new RejectFriendService(mockFriendRepo);
      await service.execute('f-123', 'user-2');

      expect(mockFriendRepo.delete).toHaveBeenCalledWith('f-123', 'user-2');
    });

    it('should propagate FriendshipNotFoundError if not found', async () => {
      vi.mocked(mockFriendRepo.delete).mockRejectedValue(new FriendshipNotFoundError());

      const service = new RejectFriendService(mockFriendRepo);
      await expect(service.execute('f-none', 'user-2')).rejects.toThrow(FriendshipNotFoundError);
    });
  });

  describe('RemoveFriendService', () => {
    it('should call repo.delete to remove friendship', async () => {
      vi.mocked(mockFriendRepo.delete).mockResolvedValue(undefined);

      const service = new RemoveFriendService(mockFriendRepo);
      await service.execute('f-123', 'user-1');

      expect(mockFriendRepo.delete).toHaveBeenCalledWith('f-123', 'user-1');
    });
  });

  describe('ListFriendsService', () => {
    it('should return list of accepted friends', async () => {
      const mockFriends: FriendResponse[] = [
        {
          user_id: 'user-2',
          username: 'alice',
          fullname: 'Alice Wonderland',
          status: 'accepted',
          created_at: new Date(),
        },
      ];
      vi.mocked(mockFriendRepo.listFriends).mockResolvedValue(mockFriends);

      const service = new ListFriendsService(mockFriendRepo);
      const result = await service.execute('user-1');

      expect(mockFriendRepo.listFriends).toHaveBeenCalledWith('user-1');
      expect(result).toEqual(mockFriends);
    });
  });

  describe('ListPendingFriendsService', () => {
    it('should return list of pending incoming friend requests', async () => {
      const mockPending: FriendResponse[] = [
        {
          user_id: 'user-3',
          username: 'charlie',
          fullname: 'Charlie Brown',
          status: 'pending',
          created_at: new Date(),
        },
      ];
      vi.mocked(mockFriendRepo.listPendingIncoming).mockResolvedValue(mockPending);

      const service = new ListPendingFriendsService(mockFriendRepo);
      const result = await service.execute('user-1');

      expect(mockFriendRepo.listPendingIncoming).toHaveBeenCalledWith('user-1');
      expect(result).toEqual(mockPending);
    });
  });
});
