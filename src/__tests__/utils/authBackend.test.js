import {getOrCreateBackendUser} from '../../utils/authBackend';

const request = overrides => ({
    baseUrl: 'https://example.test/',
    email: 'person+kyzen@example.com',
    profile: {name: 'Kyzen User', firebaseId: 'firebase-1'},
    headers: {'X-Advisor-Subdomain': 'kyzen'},
    ...overrides,
});

describe('getOrCreateBackendUser', () => {
    test('returns an existing profile without calling the create endpoint', async () => {
        const existing = {data: {User: {email: 'person+kyzen@example.com'}}};
        const httpClient = {
            get: jest.fn().mockResolvedValue(existing),
            post: jest.fn(),
        };

        await expect(
            getOrCreateBackendUser(request({httpClient})),
        ).resolves.toBe(existing);
        expect(httpClient.post).not.toHaveBeenCalled();
        expect(httpClient.get).toHaveBeenCalledWith(
            'https://example.test/api/user/getUser/person%2Bkyzen%40example.com?includeAdvisorConfig=true',
            expect.objectContaining({timeout: 10000}),
        );
    });

    test('creates a missing profile and then reads the canonical response', async () => {
        const missing = {response: {status: 404}};
        const created = {data: {User: {email: 'person+kyzen@example.com'}}};
        const httpClient = {
            get: jest.fn().mockRejectedValueOnce(missing).mockResolvedValueOnce(created),
            post: jest.fn().mockResolvedValue({status: 201}),
        };

        await expect(
            getOrCreateBackendUser(request({httpClient})),
        ).resolves.toBe(created);
        expect(httpClient.post).toHaveBeenCalledWith(
            'https://example.test/api/user/',
            {
                email: 'person+kyzen@example.com',
                name: 'Kyzen User',
                firebaseId: 'firebase-1',
            },
            expect.objectContaining({timeout: 10000}),
        );
        expect(httpClient.get).toHaveBeenCalledTimes(2);
    });

    test('recovers from a create race that returns conflict', async () => {
        const httpClient = {
            get: jest
                .fn()
                .mockRejectedValueOnce({response: {status: 404}})
                .mockResolvedValueOnce({data: {User: {email: 'person+kyzen@example.com'}}}),
            post: jest.fn().mockRejectedValue({response: {status: 409}}),
        };

        await expect(
            getOrCreateBackendUser(request({httpClient})),
        ).resolves.toEqual({data: {User: {email: 'person+kyzen@example.com'}}});
    });

    test('does not hide service or credential failures', async () => {
        const failure = {response: {status: 401}};
        const httpClient = {
            get: jest.fn().mockRejectedValue(failure),
            post: jest.fn(),
        };

        await expect(
            getOrCreateBackendUser(request({httpClient})),
        ).rejects.toBe(failure);
        expect(httpClient.post).not.toHaveBeenCalled();
    });
});

