import { Icon } from '@iconify/react';
import { Box } from '@material-ui/core';
import { useTranslation } from 'react-i18next';
import Job from '../../lib/k8s/job';
import { LightTooltip, StatusLabel, StatusLabelProps } from '../common';
import ResourceListView from '../common/Resource/ResourceListView';

export function makePodStatusLabel(job: Job) {
  if (!job?.status?.conditions) {
    return null;
  }

  const condition = job.status.conditions.find(
    ({ status }: { status: string }) => status === 'True'
  );

  const tooltip = '';

  const conditionOptions = {
    Failed: {
      status: 'error',
      icon: 'mdi:alert-outline',
    },
    Complete: {
      status: 'success',
      icon: 'mdi:check-bold',
    },
    Suspended: {
      status: '',
      icon: 'mdi:pauseIcon',
    },
  };

  const conditionInfo = conditionOptions[(condition.type as 'Complete' | 'Failed') || 'Suspended'];

  return (
    <LightTooltip title={tooltip} interactive>
      <Box display="inline">
        <StatusLabel status={conditionInfo.status as StatusLabelProps['status']}>
          {condition.type}
          <Box
            aria-label="hidden"
            display="inline"
            paddingTop={1}
            paddingLeft={0.5}
            style={{ verticalAlign: 'text-top' }}
          >
            <Icon icon={conditionInfo.icon} width="1.2rem" height="1.2rem" />
          </Box>
        </StatusLabel>
      </Box>
    </LightTooltip>
  );
}

export default function JobsList() {
  const [jobs, error] = Job.useList();
  return <JobsListRenderer jobs={jobs} error={Job.getErrorMessage(error)} />;
}

export interface JobsListRendererProps {
  jobs?: Job[] | null;
  error?: string | null;
}

export function JobsListRenderer(props: JobsListRendererProps) {
  const { jobs = null, error } = props;
  const { t } = useTranslation('glossary');

  function getCompletions(job: Job) {
    return `${job.spec.completions}/${job.spec.parallelism}`;
  }

  function sortByCompletions(job1: Job, job2: Job) {
    const parallelismSorted = job1.spec.parallelism - job2.spec.parallelism;
    if (parallelismSorted === 0) {
      return job1.spec.completions - job2.spec.completions;
    }
    return parallelismSorted;
  }

  return (
    <ResourceListView
      title={t('Jobs')}
      errorMessage={error}
      columns={[
        'name',
        'namespace',
        {
          id: 'completions',
          label: t('Completions'),
          getter: job => getCompletions(job),
          sort: sortByCompletions,
        },
        {
          id: 'conditions',
          label: t('Conditions'),
          getter: job => makePodStatusLabel(job),
        },
        'age',
      ]}
      data={jobs}
      id="headlamp-jobs"
    />
  );
}
