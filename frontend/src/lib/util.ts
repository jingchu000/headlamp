import humanizeDuration from 'humanize-duration';
import { JSONPath } from 'jsonpath-plus';
import React from 'react';
import { matchPath, useHistory } from 'react-router';
import helpers from '../helpers';
import { useTypedSelector } from '../redux/reducers/reducers';
import store from '../redux/stores/store';
import { ApiError } from './k8s/apiProxy';
import { KubeMetrics, KubeObjectInterface, Workload } from './k8s/cluster';
import { KubeEvent } from './k8s/event';
import Node from './k8s/node';
import { parseCpu, parseRam, unparseCpu, unparseRam } from './units';

// @todo: these are exported to window.pluginLib.

const humanize = humanizeDuration.humanizer();
humanize.languages['en-mini'] = {
  y: () => 'y',
  mo: () => 'mo',
  w: () => 'w',
  d: () => 'd',
  h: () => 'h',
  m: () => 'm',
  s: () => 's',
  ms: () => 'ms',
};

export const CLUSTER_ACTION_GRACE_PERIOD = 5000; // ms

export type DateParam = string | number | Date;

export type DateFormatOptions = 'brief' | 'mini';

export interface TimeAgoOptions {
  format?: DateFormatOptions;
}

/**
 * Show the time passed since the given date, in the desired format.
 *
 * @param date - The date since which to calculate the duration.
 * @param options - `format` takes "brief" or "mini". "brief" rounds the date and uses the largest suitable unit (e.g. "4 weeks"). "mini" uses something like "4w" (for 4 weeks).
 * @returns The formatted date.
 */
export function timeAgo(date: DateParam, options: TimeAgoOptions = {}) {
  const { format = 'brief' } = options;

  const fromDate = new Date(date);
  let now = new Date();

  if (process.env.UNDER_TEST === 'true') {
    // For testing, we consider the current moment to be 3 months from the dates we are testing.
    const days = 24 * 3600 * 1000; // in ms
    now = new Date(fromDate.getTime() + 90 * days);
  }

  if (format === 'brief') {
    return humanize(now.getTime() - fromDate.getTime(), {
      fallbacks: ['en'],
      round: true,
      largest: 1,
    });
  }

  return humanize(now.getTime() - fromDate.getTime(), {
    language: 'en-mini',
    spacer: '',
    fallbacks: ['en'],
    round: true,
    largest: 1,
  });
}

export function localeDate(date: DateParam) {
  const options: Intl.DateTimeFormatOptions = { timeZoneName: 'short' };
  let locale: string | undefined = undefined;

  // Force the same conditions under test, so snapshots are the same.
  if (process.env.UNDER_TEST === 'true') {
    options.timeZone = 'UTC';
    options.hour12 = true;
    locale = 'en-US';
    return new Date(date).toISOString();
  } else {
    options.timeZone = store.getState().config.settings.timezone;
  }

  return new Date(date).toLocaleString(locale, options);
}

export function getPercentStr(value: number, total: number) {
  if (total === 0) {
    return null;
  }
  const percentage = (value / total) * 100;
  const decimals = percentage % 10 > 0 ? 1 : 0;
  return `${percentage.toFixed(decimals)} %`;
}

export function getReadyReplicas(item: Workload) {
  return item.status.readyReplicas || item.status.numberReady || 0;
}

export function getTotalReplicas(item: Workload) {
  return item.spec.replicas || item.status.currentNumberScheduled || 0;
}

export function getResourceStr(value: number, resourceType: 'cpu' | 'memory') {
  const resourceFormatters: any = {
    cpu: unparseCpu,
    memory: unparseRam,
  };

  const valueInfo = resourceFormatters[resourceType](value);
  return `${valueInfo.value}${valueInfo.unit}`;
}

export function getResourceMetrics(
  item: Node,
  metrics: KubeMetrics[],
  resourceType: 'cpu' | 'memory'
) {
  const resourceParsers: any = {
    cpu: parseCpu,
    memory: parseRam,
  };

  const parser = resourceParsers[resourceType];
  const itemMetrics = metrics.find(itemMetrics => itemMetrics.metadata.name === item.getName());

  const used = parser(itemMetrics ? itemMetrics.usage[resourceType] : '0');
  const capacity = parser(item.status.capacity[resourceType]);

  return [used, capacity];
}

export interface FilterState {
  namespaces: Set<string>;
  search: string;
}

export function filterResource(
  item: KubeObjectInterface | KubeEvent,
  filter: FilterState,
  matchCriteria?: string[]
) {
  let matches: boolean = true;

  if (item.metadata.namespace && filter.namespaces.size > 0) {
    matches = filter.namespaces.has(item.metadata.namespace);
  }

  if (!matches) {
    return false;
  }

  if (filter.search) {
    const filterString = filter.search.toLowerCase();
    const usedMatchCriteria = [
      item.metadata.uid.toLowerCase(),
      item.metadata.namespace ? item.metadata.namespace.toLowerCase() : '',
      item.metadata.name.toLowerCase(),
      ...Object.keys(item.metadata.labels || {}).map(item => item.toLowerCase()),
      ...Object.values(item.metadata.labels || {}).map(item => item.toLowerCase()),
    ];

    matches = !!usedMatchCriteria.find(item => item.includes(filterString));
    if (matches) {
      return true;
    }

    matches = filterGeneric(item, filter, matchCriteria);
  }

  return matches;
}

/** Filters a generic item based on the filter state.
 * The item is considered to match if any of the matchCriteria (described as JSONPath) matches the filter.search contents. Case matching is insensitive.
 *
 * @param item - The item to filter.
 * @param filter - The filter state.
 * @param matchCriteria - The JSONPath criteria to match.
 */
export function filterGeneric<T extends { [key: string]: any } = { [key: string]: any }>(
  item: T,
  filter: FilterState,
  matchCriteria?: string[]
) {
  if (!filter.search) {
    return true;
  }

  const filterString = filter.search.toLowerCase();
  const usedMatchCriteria: string[] = [];

  // Use the custom matchCriteria if any
  (matchCriteria || []).forEach(jsonPath => {
    let values: any[];
    try {
      values = JSONPath({ path: '$' + jsonPath, json: item });
    } catch (err) {
      console.debug(
        `Failed to get value from JSONPath when filtering ${jsonPath} on item ${item}; skipping criteria`
      );
      return;
    }

    // Include matches values in the criteria
    values.forEach((value: any) => {
      if (typeof value === 'string' || typeof value === 'number') {
        // Don't use empty string, otherwise it'll match everything
        if (value !== '') {
          usedMatchCriteria.push(value.toString().toLowerCase());
        }
      } else if (Array.isArray(value)) {
        value.forEach((elem: any) => {
          if (!!elem && typeof elem === 'string') {
            usedMatchCriteria.push(elem.toLowerCase());
          }
        });
      }
    });
  });

  return !!usedMatchCriteria.find(item => item.includes(filterString));
}

export function useFilterFunc<
  T extends { [key: string]: any } | KubeObjectInterface | KubeEvent =
    | KubeObjectInterface
    | KubeEvent
>(matchCriteria?: string[]) {
  const filter = useTypedSelector(state => state.filter);

  return (item: T) => {
    if (!!item.metadata) {
      return filterResource(item as KubeObjectInterface | KubeEvent, filter, matchCriteria);
    }
    return filterGeneric<T>(item, filter, matchCriteria);
  };
}

export function getClusterPrefixedPath(path?: string | null) {
  const baseClusterPath = '/c/:cluster';
  if (!path) {
    return baseClusterPath;
  }
  return baseClusterPath + (path[0] === '/' ? '' : '/') + path;
}

export function getCluster(): string | null {
  const prefix = helpers.getBaseUrl();
  const urlPath = helpers.isElectron()
    ? window.location.hash.substr(1)
    : window.location.pathname.slice(prefix.length);

  const clusterURLMatch = matchPath<{ cluster?: string }>(urlPath, {
    path: getClusterPrefixedPath(),
  });
  return (!!clusterURLMatch && clusterURLMatch.params.cluster) || null;
}

export function useErrorState(dependentSetter?: (...args: any) => void) {
  const [error, setError] = React.useState<ApiError | null>(null);

  React.useEffect(
    () => {
      if (!!error && !!dependentSetter) {
        dependentSetter(null);
      }
    },
    // eslint-disable-next-line
    [error]
  );

  // Adding "as any" here because it was getting difficult to validate the setter type.
  return [error, setError as any];
}

type URLStateParams<T> = {
  /** The defaultValue for the URL state. */
  defaultValue: T;
  /** Whether to hide the parameter when the value is the default one (true by default). */
  hideDefault?: boolean;
  /** The prefix of the URL key to use for this state (a prefix 'my' with a key name 'key' will be used in the URL as 'my.key'). */
  prefix?: string;
};
export function useURLState(
  key: string,
  defaultValue: number
): [number, React.Dispatch<React.SetStateAction<number>>];
export function useURLState(
  key: string,
  valueOrParams: number | URLStateParams<number>
): [number, React.Dispatch<React.SetStateAction<number>>];
/**
 * A hook to manage a state variable that is also stored in the URL.
 *
 * @param key The name of the key in the URL. If empty, then the hook behaves like useState.
 * @param paramsOrDefault The default value of the state variable, or the params object.
 *
 */
export function useURLState<T extends string | number | undefined = string>(
  key: string,
  paramsOrDefault: T | URLStateParams<T>
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const params: URLStateParams<T> =
    typeof paramsOrDefault === 'object' ? paramsOrDefault : { defaultValue: paramsOrDefault };
  const { defaultValue, hideDefault = true, prefix = '' } = params;
  const history = useHistory();
  // Don't even use the prefix if the key is empty
  const fullKey = !key ? '' : !!prefix ? prefix + '.' + key : key;

  function getURLValue() {
    // An empty key means that we don't want to use the state from the URL.
    if (fullKey === '') {
      return null;
    }

    const urlParams = new URLSearchParams(history.location.search);
    const urlValue = urlParams.get(fullKey);
    if (urlValue === null) {
      return null;
    }
    let newValue: string | number = urlValue;
    if (typeof defaultValue === 'number') {
      newValue = Number(urlValue);
      if (Number.isNaN(newValue)) {
        return null;
      }
    }

    return newValue;
  }

  const initialValue = React.useMemo(() => {
    const newValue = getURLValue();
    if (newValue === null) {
      return defaultValue;
    }
    return newValue;
  }, []);
  const [value, setValue] = React.useState<T>(initialValue as T);

  React.useEffect(
    () => {
      const newValue = getURLValue();
      if (newValue === null) {
        if (defaultValue !== undefined && defaultValue !== value) {
          setValue(defaultValue);
        }
      } else if (newValue !== value) {
        setValue(newValue as T);
      }
    },
    // eslint-disable-next-line
    [history]
  );

  React.useEffect(() => {
    // An empty key means that we don't want to use the state from the URL.
    if (fullKey === '') {
      return;
    }

    const urlCurrentValue = getURLValue();

    if (urlCurrentValue === value) {
      return;
    }

    const urlParams = new URLSearchParams(history.location.search);
    let shouldUpdateURL = false;

    if ((value === null || value === defaultValue) && hideDefault) {
      if (urlParams.has(fullKey)) {
        urlParams.delete(fullKey);
        shouldUpdateURL = true;
      }
    } else if (value !== undefined) {
      const urlValue = value as NonNullable<T>;

      urlParams.set(fullKey, urlValue.toString());
      shouldUpdateURL = true;
    }

    if (shouldUpdateURL) {
      history.replace({ search: urlParams.toString() });
    }
  }, [value]);

  return [value, setValue] as [T, React.Dispatch<React.SetStateAction<T>>];
}

// compareUnits compares two units and returns true if they are equal
export function compareUnits(quantity1: string, quantity2: string) {
  // strip whitespace and convert to lowercase
  const qty1 = quantity1.replace(/\s/g, '').toLowerCase();
  const qty2 = quantity2.replace(/\s/g, '').toLowerCase();

  // compare numbers
  return parseInt(qty1) === parseInt(qty2);
}

export function normalizeUnit(resourceType: string, quantity: string) {
  let type = resourceType;

  if (type.includes('.')) {
    type = type.split('.')[1];
  }

  let normalizedQuantity = '';
  let bytes = 0;
  switch (type) {
    case 'cpu':
      normalizedQuantity = quantity?.endsWith('m')
        ? `${Number(quantity.substring(0, quantity.length - 1)) / 1000}`
        : `${quantity}`;
      if (normalizedQuantity === '0' || normalizedQuantity === '1') {
        normalizedQuantity = '0 ' + 'core';
      } else {
        normalizedQuantity = normalizedQuantity + ' ' + 'cores';
      }
      break;

    case 'memory':
      /**
       * Decimal: m | n | "" | k | M | G | T | P | E
       * Binary: Ki | Mi | Gi | Ti | Pi | Ei
       * Refer https://github.com/kubernetes-client/csharp/blob/840a90e24ef922adee0729e43859cf6b43567594/src/KubernetesClient.Models/ResourceQuantity.cs#L211
       */
      console.log('debug:', quantity, parseInt(quantity), quantity.endsWith('m'));
      bytes = parseInt(quantity);
      if (quantity.endsWith('Ki')) {
        bytes *= 1024;
      } else if (quantity.endsWith('Mi')) {
        bytes *= 1024 * 1024;
      } else if (quantity.endsWith('Gi')) {
        bytes *= 1024 * 1024 * 1024;
      } else if (quantity.endsWith('Ti')) {
        bytes *= 1024 * 1024 * 1024 * 1024;
      } else if (quantity.endsWith('Ei')) {
        bytes *= 1024 * 1024 * 1024 * 1024 * 1024;
      } else if (quantity.endsWith('m')) {
        bytes /= 1000;
      } else if (quantity.endsWith('u')) {
        bytes /= 1000 * 1000;
      } else if (quantity.endsWith('n')) {
        bytes /= 1000 * 1000 * 1000;
      } else if (quantity.endsWith('k')) {
        bytes *= 1000;
      } else if (quantity.endsWith('M')) {
        bytes *= 1000 * 1000;
      } else if (quantity.endsWith('G')) {
        bytes *= 1000 * 1000 * 1000;
      } else if (quantity.endsWith('T')) {
        bytes *= 1000 * 1000 * 1000 * 1000;
      } else if (quantity.endsWith('E')) {
        bytes *= 1000 * 1000 * 1000 * 1000 * 1000;
      }

      if (bytes === 0) {
        normalizedQuantity = '0 Bytes';
      } else {
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
        const k = 1000;
        const dm = 2;
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        console.debug('debug bytes:', bytes, i, sizes);
        normalizedQuantity = parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
      }
      break;

    default:
      normalizedQuantity = quantity;
      break;
  }
  return normalizedQuantity;
}

/** Creates a unique ID, with the given prefix.
 * If UNDER_TEST is set to true, it will return the same ID every time, so snapshots do not get invalidated.
 */
export function useId(prefix = '') {
  const [id] = React.useState<string | undefined>(
    process.env.UNDER_TEST === 'true' ? prefix + 'id' : prefix + Math.random().toString(16).slice(2)
  );

  return id;
}

// Make units available from here
export * as auth from './auth';
export * as units from './units';
