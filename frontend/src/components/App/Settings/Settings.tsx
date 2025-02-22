import { Box } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch } from 'react-redux';
import LocaleSelect from '../../../i18n/LocaleSelect/LocaleSelect';
import { setAppSettings, setVersionDialogOpen } from '../../../redux/actions/actions';
import { defaultTableRowsPerPageOptions } from '../../../redux/reducers/config';
import { ActionButton, NameValueTable, SectionBox } from '../../common';
import TimezoneSelect from '../../common/TimezoneSelect';
import { useSettings } from './hook';
import NumRowsInput from './NumRowsInput';
import ThemeChangeButton from './ThemeChangeButton';

const useStyles = makeStyles(theme => ({
  valueCol: {
    width: '60%',
    [theme.breakpoints.down('sm')]: {
      width: 'unset',
    },
  },
}));

export default function Settings() {
  const classes = useStyles();
  const { t } = useTranslation(['settings', 'frequent']);
  const settingsObj = useSettings();
  const storedTimezone = settingsObj.timezone;
  const storedRowsPerPageOptions = settingsObj.tableRowsPerPageOptions;
  const [selectedTimezone, setSelectedTimezone] = useState<string>(
    storedTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone
  );
  const dispatch = useDispatch();

  useEffect(() => {
    dispatch(
      setAppSettings({
        timezone: selectedTimezone,
      })
    );
  }, [selectedTimezone]);

  return (
    <SectionBox
      title={t('frequent|General')}
      headerProps={{
        actions: [
          <ActionButton
            key="version"
            icon="mdi:information-outline"
            description={t('Version')}
            onClick={() => {
              dispatch(setVersionDialogOpen(true));
            }}
          />,
        ],
      }}
      backLink
    >
      <NameValueTable
        valueCellProps={{ className: classes.valueCol }}
        rows={[
          {
            name: t('frequent|Language'),
            value: <LocaleSelect showFullNames formControlProps={{ className: '' }} />,
          },
          {
            name: t('frequent|Theme'),
            value: <ThemeChangeButton showBothIcons />,
          },
          {
            name: t('settings|Number of rows for tables'),
            value: (
              <NumRowsInput
                defaultValue={storedRowsPerPageOptions || defaultTableRowsPerPageOptions}
              />
            ),
          },
          {
            name: t('settings|Timezone to display for dates'),
            value: (
              <Box maxWidth="350px">
                <TimezoneSelect
                  initialTimezone={selectedTimezone}
                  onChange={name => setSelectedTimezone(name)}
                />
              </Box>
            ),
          },
        ]}
      />
    </SectionBox>
  );
}
