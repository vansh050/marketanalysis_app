import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {TextInput, TouchableOpacity, Text} from 'react-native';
import TelegramCollectionModal from '../../components/ModelPortfolioComponents/TelegramCollectionModal';

jest.mock('../../context/ConfigContext', () => ({useConfig: () => ({})}));
jest.mock('../../theme/useTokens', () => () => ({colors: {brand: {primary: '#123456'}}}));
jest.mock('lucide-react-native', () => ({X: 'X', MessageCircle: 'MessageCircle', CheckCircle: 'CheckCircle'}));

// The design screen passes initialValue / onValueChange / validateId. The
// modal used to read only telegramId / setTelegramId / validateTelegramId and
// threw on first render, closing the app right after a successful payment.
const validate = id => Boolean(id && id.length >= 5 && /^\d+$/.test(id));
const pressable = (tree, label) => tree.root.findAllByType(TouchableOpacity).find(button =>
  button.findAllByType(Text).some(node => node.props.children === label),
);

describe('TelegramCollectionModal prop contract', () => {
  let tree;
  afterEach(() => act(() => tree?.unmount()));

  test('renders and saves with the props the design screen passes', async () => {
    const onSave = jest.fn().mockResolvedValue();
    const onValueChange = jest.fn();
    const onClose = jest.fn();
    await act(async () => {
      tree = renderer.create(
        <TelegramCollectionModal
          visible
          onClose={onClose}
          onSave={onSave}
          initialValue=""
          onValueChange={onValueChange}
          validateId={validate}
        />,
      );
    });
    const input = tree.root.findByType(TextInput);
    await act(async () => input.props.onChangeText('12a3456'));
    expect(onValueChange).toHaveBeenCalledWith('123456');
    expect(tree.root.findByType(TextInput).props.value).toBe('123456');
    await act(async () => pressable(tree, 'Save & Continue').props.onPress());
    expect(onSave).toHaveBeenCalledWith('123456');
  });

  test('renders with no validator at all', async () => {
    await act(async () => {
      tree = renderer.create(<TelegramCollectionModal visible onClose={jest.fn()} onSave={jest.fn()} />);
    });
    expect(tree.root.findByType(TextInput).props.value).toBe('');
  });

  test('keeps the controlled props working', async () => {
    const setTelegramId = jest.fn();
    await act(async () => {
      tree = renderer.create(
        <TelegramCollectionModal
          visible
          onClose={jest.fn()}
          onSave={jest.fn()}
          telegramId="98765"
          setTelegramId={setTelegramId}
          validateTelegramId={validate}
        />,
      );
    });
    expect(tree.root.findByType(TextInput).props.value).toBe('98765');
    await act(async () => tree.root.findByType(TextInput).props.onChangeText('987654'));
    expect(setTelegramId).toHaveBeenCalledWith('987654');
  });
});
