import { configureStore } from '@reduxjs/toolkit';
import { Meta, Story } from '@storybook/react/types-6-0';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { INITIAL_STATE } from '../../../redux/reducers/config';
import Home from '.';

const ourState = {
  config: {
    ...INITIAL_STATE,
    clusters: [
      {
        name: 'cluster0',
      },
      {
        name: 'cluster2',
      },
      {
        name: 'cluster1',
      },
    ],
  },
  filter: {
    search: '',
  },
};

// @todo: Add a way for the results from useClustersVersion to be mocked, so not
// all clusters appear as not accessible.
export default {
  title: 'Home/Home',
  component: Home,
  decorators: [
    Story => {
      return (
        <MemoryRouter>
          <Provider
            store={configureStore({
              reducer: (state = ourState) => state,
              preloadedState: ourState,
            })}
          >
            <Story />
          </Provider>
        </MemoryRouter>
      );
    },
  ],
} as Meta;

const Template: Story = () => <Home />;

export const Base = Template.bind({});
