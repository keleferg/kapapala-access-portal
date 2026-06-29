export const mockLiveActivity = {
  accountRequests: 4,
  dailyRequestsToday: 18,
  smsSentToday: 16,
  gateStatus: 'All Gates Open',
};

export const mockAccessAccounts = [
  {
    id: 'kap-00482',
    access_id: 'KAP-2026-00482',
    name: 'Kele Fergerstrom',
    status: 'active',
    expires_at: '2028-06-30',
    trips: 147,
    last_visit: 'Yesterday',
    vehicles: ['White Tacoma', 'Polaris Ranger'],
  },
  {
    id: 'kap-00142',
    access_id: 'KAP-2026-00142',
    name: 'John Smith',
    status: 'active',
    expires_at: '2028-04-12',
    trips: 23,
    last_visit: 'June 21, 2026',
    vehicles: ['Ford F-150'],
  },
  {
    id: 'kap-00143',
    access_id: 'KAP-2026-00143',
    name: 'Jane Akana',
    status: 'pending',
    expires_at: null,
    trips: 0,
    last_visit: '—',
    vehicles: ['Toyota 4Runner'],
  },
];

export const mockGates = [
  { name: 'Wood Valley', status: 'open', road_condition: 'Good', notes: 'Primary public entrance gate.' },
  { name: 'Honanui', status: 'open', road_condition: 'Fair', notes: 'Public access gate.' },
  { name: 'ʻĀinapō', status: 'restricted', road_condition: '4WD recommended', notes: 'Upper forest access.' },
];
