import { Icon } from '@iconify/react';
import { useTheme } from '@material-ui/core';
import Box from '@material-ui/core/Box';
import IconButton from '@material-ui/core/IconButton';
import ListItemText from '@material-ui/core/ListItemText';
import Menu from '@material-ui/core/Menu';
import MenuItem from '@material-ui/core/MenuItem';
import Typography from '@material-ui/core/Typography';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch } from 'react-redux';
import { useHistory } from 'react-router-dom';
import helpers from '../../../helpers';
import { useClustersConf, useClustersVersion } from '../../../lib/k8s';
import { ApiError, deleteCluster } from '../../../lib/k8s/apiProxy';
import { Cluster } from '../../../lib/k8s/cluster';
import { createRouteURL } from '../../../lib/router';
import { useFilterFunc, useId } from '../../../lib/util';
import { setConfig } from '../../../redux/actions/actions';
import { Link, PageGrid, SectionBox, SectionFilterHeader, SimpleTable } from '../../common';
import RecentClusters from './RecentClusters';

function ContextMenu({ cluster }: { cluster: Cluster }) {
  const { t } = useTranslation(['settings', 'frequent']);
  const history = useHistory();
  const dispatch = useDispatch();
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const menuId = useId('context-menu');

  function removeCluster(cluster: Cluster) {
    deleteCluster(cluster.name || '')
      .then(config => {
        dispatch(setConfig(config));
      })
      .catch((err: Error) => {
        if (err.message === 'Not Found') {
          // TODO: create notification with error message
        }
      })
      .finally(() => {
        history.push('/');
      });
  }

  function handleMenuClose() {
    setAnchorEl(null);
  }

  return (
    <>
      <IconButton
        size="small"
        onClick={event => {
          setAnchorEl(event.currentTarget);
        }}
        aria-haspopup="menu"
        aria-controls={menuId}
        aria-label={t('frequent|Actions')}
      >
        <Icon icon="mdi:more-vert" />
      </IconButton>
      <Menu
        id={menuId}
        anchorEl={anchorEl}
        keepMounted
        open={Boolean(anchorEl)}
        onClose={() => {
          handleMenuClose();
        }}
      >
        <MenuItem
          onClick={() => {
            history.push(createRouteURL('cluster', { cluster: cluster.name }));
            handleMenuClose();
          }}
        >
          <ListItemText>{t('settings|View')}</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            history.push(createRouteURL('settingsCluster', { cluster: cluster.name }));
            handleMenuClose();
          }}
        >
          <ListItemText>{t('settings|Settings')}</ListItemText>
        </MenuItem>
        {helpers.isElectron() && cluster.meta_data?.source === 'dynamic_cluster' && (
          <MenuItem
            onClick={() => {
              removeCluster(cluster);
              handleMenuClose();
            }}
          >
            <ListItemText>{t('frequent|Delete')}</ListItemText>
          </MenuItem>
        )}
      </Menu>
    </>
  );
}

function ClusterStatus({ error }: { error?: ApiError | null }) {
  const { t } = useTranslation(['cluster', 'frequent']);
  const theme = useTheme();

  const stateUnknown = error === undefined;
  const hasReachError = error && error.status !== 401 && error.status !== 403;

  return (
    <Box width="fit-content">
      <Box display="flex" alignItems="center" justifyContent="center">
        {hasReachError ? (
          <Icon icon="mdi:cloud-off" width={16} color={theme.palette.home.status.error} />
        ) : stateUnknown ? (
          <Icon icon="mdi:cloud-question" width={16} color={theme.palette.home.status.unknown} />
        ) : (
          <Icon
            icon="mdi:cloud-check-variant"
            width={16}
            color={theme.palette.home.status.success}
          />
        )}
        <Typography
          variant="body2"
          style={{
            marginLeft: theme.spacing(1),
            color: hasReachError
              ? theme.palette.home.status.error
              : !stateUnknown
              ? theme.palette.home.status.success
              : undefined,
          }}
        >
          {hasReachError ? error.message : stateUnknown ? '⋯' : t('frequent|Active')}
        </Typography>
      </Box>
    </Box>
  );
}

export default function Home() {
  const history = useHistory();
  const clusters = useClustersConf() || {};

  if (!helpers.isElectron() && Object.keys(clusters).length === 1) {
    history.push(createRouteURL('cluster', { cluster: Object.keys(clusters)[0] }));
    return null;
  }

  return <HomeComponent clusters={clusters} />;
}

interface HomeComponentProps {
  clusters: { [name: string]: Cluster };
}

function HomeComponent(props: HomeComponentProps) {
  const { clusters } = props;
  const { t } = useTranslation(['glossary', 'frequent']);
  const [versions, errors] = useClustersVersion(Object.values(clusters));
  const filterFunc = useFilterFunc<Cluster>(['.name']);

  return (
    <PageGrid>
      <SectionBox headerProps={{ headerStyle: 'main' }} title={t('Home')}>
        <RecentClusters clusters={Object.values(clusters)} onButtonClick={() => {}} />
      </SectionBox>
      <SectionBox
        title={
          <SectionFilterHeader
            title={t('All Clusters')}
            noNamespaceFilter
            headerStyle="subsection"
          />
        }
      >
        <SimpleTable
          filterFunction={filterFunc}
          defaultSortingColumn={1}
          columns={[
            {
              label: t('frequent|Name'),
              getter: ({ name }: Cluster) => (
                <Link routeName="cluster" params={{ cluster: name }}>
                  {name}
                </Link>
              ),
              sort: (c1: Cluster, c2: Cluster) => c1.name.localeCompare(c2.name),
            },
            {
              label: t('glossary|Status'),
              getter: ({ name }: Cluster) => <ClusterStatus error={errors[name]} />,
            },
            {
              label: t('frequent|Kubernetes Version'),
              getter: ({ name }: Cluster) => versions[name]?.gitVersion || '⋯',
              sort: true,
            },
            {
              label: '',
              getter: (cluster: Cluster) => (
                <Box textAlign="right">
                  <ContextMenu cluster={cluster} />
                </Box>
              ),
            },
          ]}
          data={Object.values(clusters)}
        />
      </SectionBox>
    </PageGrid>
  );
}
