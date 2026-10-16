const React = require('react');
const TestRenderer = require('react-test-renderer');
const {act} = TestRenderer;
const AngelOneCautionaryWarning = require(
  '../components/BrokerConnectionModal/AngelOneCautionaryWarning',
).default;

describe('AngelOneCautionaryWarning controlled picker mode', () => {
  test('acknowledgement and cancellation are returned to the broker container', () => {
    const onAck = jest.fn();
    const onCancel = jest.fn();
    let renderer;

    act(() => {
      renderer = TestRenderer.create(
        React.createElement(AngelOneCautionaryWarning, {
          visible: true,
          onAck,
          onCancel,
        }),
      );
    });

    const pressables = renderer.root.findAll(
      node => typeof node.props.onPress === 'function',
    );
    const textFor = node => node.children
      .map(child => typeof child === 'string' ? child : textFor(child))
      .join(' ');
    const proceed = pressables.find(node =>
      textFor(node).includes('Got it — Connect Angel One'),
    );
    const cancel = pressables.find(node => textFor(node).includes('Cancel'));

    act(() => proceed.props.onPress());
    act(() => cancel.props.onPress());

    expect(onAck).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  test('does not render when controlled visibility is false', () => {
    let renderer;
    act(() => {
      renderer = TestRenderer.create(
        React.createElement(AngelOneCautionaryWarning, {
          visible: false,
          onAck: jest.fn(),
        }),
      );
    });
    expect(renderer.toJSON()).toBeNull();
  });
});
