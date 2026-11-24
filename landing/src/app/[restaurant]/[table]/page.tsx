import RestaurantTableQrClient from './TableQrClient';

export function generateStaticParams() {
  return [
    { restaurant: 'default', table: '1' },
    { restaurant: 'preview', table: '1' },
    { restaurant: 'demo', table: '1' },
    { restaurant: 'demo', table: 'table-1' },
    { restaurant: 'order-it-up', table: '1' },
    { restaurant: 'order-it-up', table: 'T1' },
  ];
}

export default function Page() {
  return <RestaurantTableQrClient />;
}
