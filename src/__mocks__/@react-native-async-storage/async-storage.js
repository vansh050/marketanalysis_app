const store = {};

const AsyncStorage = {
  getItem: jest.fn((key) => Promise.resolve(store[key] || null)),
  setItem: jest.fn((key, value) => {
    store[key] = value;
    return Promise.resolve();
  }),
  removeItem: jest.fn((key) => {
    delete store[key];
    return Promise.resolve();
  }),
  clear: jest.fn(() => {
    Object.keys(store).forEach((key) => delete store[key]);
    return Promise.resolve();
  }),
  getAllKeys: jest.fn(() => Promise.resolve(Object.keys(store))),
  multiSet: jest.fn((pairs) => {
    pairs.forEach(([key, value]) => { store[key] = value; });
    return Promise.resolve();
  }),
  multiGet: jest.fn((keys) => {
    return Promise.resolve(keys.map((key) => [key, store[key] || null]));
  }),
  multiRemove: jest.fn((keys) => {
    keys.forEach((key) => { delete store[key]; });
    return Promise.resolve();
  }),
  _store: store,
  _reset: () => {
    Object.keys(store).forEach((key) => delete store[key]);
  },
};

module.exports = AsyncStorage;
