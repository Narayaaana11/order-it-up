import RestaurantTableQrClient from './TableQrClient';

export function generateStaticParams() {
  return [
    { restaurant: 'default', table: '1' },
    { restaurant: 'preview', table: '1' },
  ];
}

export default function Page() {
  return <RestaurantTableQrClient />;
}
