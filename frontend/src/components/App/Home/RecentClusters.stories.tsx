import { Meta, Story } from '@storybook/react/types-6-0';
import React from 'react';
import helpers from '../../../helpers';
import { Cluster } from '../../../lib/k8s/cluster';
import RecentClusters, { RecentClustersProps } from './RecentClusters';

const clusters: Cluster[] = [
  {
    name: 'cluster0',
  },
  {
    name: 'cluster1',
  },
  {
    name: 'cluster2',
  },
  {
    name: 'cluster3',
  },
];

export default {
  title: 'home/RecentClusters',
  component: RecentClusters,
  argTypes: {},
} as Meta;

interface RecentClusterStoryProps extends RecentClustersProps {
  getRecentClusters: typeof helpers.getRecentClusters;
}

const Template: Story<RecentClusterStoryProps> = args => {
  const { getRecentClusters, ...props } = args;

  React.useEffect(() => {
    const clusters = getRecentClusters();
    localStorage.setItem('recent_clusters', '[]');
    for (const clusterName of clusters) {
      helpers.setRecentCluster({ name: clusterName });
    }
  });

  return <RecentClusters {...props} />;
};

export const NoClusters = Template.bind({});
NoClusters.args = {
  clusters: [],
  getRecentClusters: () => [],
};

export const OneExistingCluster = Template.bind({});
OneExistingCluster.args = {
  clusters: [clusters[0]],
  getRecentClusters: () => [clusters[0].name],
};

export const OneRecentCluster = Template.bind({});
OneRecentCluster.args = {
  clusters,
  getRecentClusters: () => [clusters[0].name],
};

export const TwoExistingClusters = Template.bind({});
TwoExistingClusters.args = {
  clusters: clusters.slice(0, 2),
  getRecentClusters: () => [clusters[0].name, clusters[1].name],
};

export const TwoRecentClusters = Template.bind({});
TwoRecentClusters.args = {
  clusters,
  getRecentClusters: () => [clusters[0].name, clusters[1].name],
};

export const ThreeClusters = Template.bind({});
ThreeClusters.args = {
  clusters,
  getRecentClusters: () => [clusters[0].name, clusters[1].name, clusters[2].name],
};

export const MoreThanThreeClusters = Template.bind({});
MoreThanThreeClusters.args = {
  clusters,
  getRecentClusters: () => clusters.map(c => c.name),
};

export const WithObsoleteClusters = Template.bind({});
WithObsoleteClusters.args = {
  clusters,
  getRecentClusters: () => ['idonotexist', clusters[0].name],
};
