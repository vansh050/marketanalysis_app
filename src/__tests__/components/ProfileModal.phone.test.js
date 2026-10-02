import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {TextInput, TouchableOpacity} from 'react-native';
import axios from 'axios';
import Toast from 'react-native-toast-message';
import ProfileModal from '../../components/ProfileModal';

jest.mock('axios', () => ({get: jest.fn(), put: jest.fn()}));
jest.mock('react-native-modal', () => 'Modal');
jest.mock('@react-navigation/native', () => ({useNavigation: () => ({navigate: jest.fn()})}));
jest.mock('../../screens/TradeContext', () => ({useTrade: () => ({configData: {config: {REACT_APP_HEADER_NAME: 'test'}}})}));
jest.mock('../../utils/SecurityTokenManager', () => ({generateToken: () => 'test-token'}));
jest.mock('../../utils/variantHelper', () => ({
  getAdvisorSubdomain: () => 'test',
  getTenantSubdomain: configData =>
    configData?.config?.REACT_APP_HEADER_NAME ||
    configData?.REACT_APP_HEADER_NAME ||
    configData?.subdomain ||
    'test',
}));
jest.mock('../../utils/serverConfig', () => ({server: {baseUrl: 'https://example.invalid/'}}));

describe('ProfileModal international phone contract', () => {
  let tree;
  beforeEach(() => {
    global.IS_REACT_ACT_ENVIRONMENT = true;
    jest.useFakeTimers();
    jest.clearAllMocks();
    axios.get.mockResolvedValue({data: {User: {name: 'Test', phone_number: '33123456', country_code: 974}}});
    axios.put.mockResolvedValue({data: {success: true}});
  });
  afterEach(() => {
    act(() => tree?.unmount());
    jest.useRealTimers();
  });
  const open = async () => {
    await act(async () => {
      tree = renderer.create(<ProfileModal showModal userEmail="test@example.invalid" setShowModal={jest.fn()} />);
    });
  };
  const save = () => tree.root.findAllByType(TouchableOpacity).find(button =>
    button.findAll(node => node.props.children === 'Save Profile').length > 0,
  );

  test('reloads Qatar country code and sends normalized national digits on save', async () => {
    await open();
    const input = tree.root.findAllByType(TextInput).find(node => node.props.placeholder === 'Enter phone');
    expect(input.props.value).toBe('33123456');
    await act(async () => input.props.onChangeText('+974 3312 3456'));
    await act(async () => save().props.onPress());
    expect(axios.put).toHaveBeenCalledWith(
      expect.stringContaining('api/user/update-profile'),
      expect.objectContaining({countryCode: '+974', phoneNumber: '33123456'}),
      expect.anything(),
    );
  });

  test('blocks invalid Qatar input before making an update request', async () => {
    await open();
    const input = tree.root.findAllByType(TextInput).find(node => node.props.placeholder === 'Enter phone');
    await act(async () => input.props.onChangeText('123'));
    await act(async () => save().props.onPress());
    expect(axios.put).not.toHaveBeenCalled();
    expect(Toast.show).toHaveBeenCalledWith(expect.objectContaining({type: 'error'}));
  });

  test('closes before refreshing the parent after a successful save', async () => {
    const setShowModal = jest.fn();
    const getUserDeatils = jest.fn(() => Promise.resolve());
    await act(async () => {
      tree = renderer.create(
        <ProfileModal
          showModal
          userEmail="test@example.invalid"
          setShowModal={setShowModal}
          getUserDeatils={getUserDeatils}
        />,
      );
    });

    await act(async () => save().props.onPress());
    expect(setShowModal).toHaveBeenCalledWith(false);
    expect(getUserDeatils).not.toHaveBeenCalled();

    const modal = tree.root.findByType('Modal');
    await act(async () => modal.props.onModalHide());
    expect(getUserDeatils).toHaveBeenCalledTimes(1);
    expect(axios.put.mock.calls[0][2].headers['X-Advisor-Subdomain']).toBe(
      'test',
    );
  });
});
