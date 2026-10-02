import React from 'react';

/**
 * Replaceable app-header shell. The src navigator owns route resolution and
 * passes its stateful toolbar as a slot; variants own whether/how it is shown.
 */
const AppHeader = ({viewModel = {}, slots = {}}) => {
  const {visible = true, currentRoute = ''} = viewModel;
  const {Toolbar} = slots;
  if (!visible || !Toolbar) return null;
  return <Toolbar currentRoute={currentRoute} />;
};

export default AppHeader;
