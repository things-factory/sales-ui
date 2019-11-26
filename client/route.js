export default function route(page) {
  switch (page) {
    case 'vas':
      import('./pages/vas-list')
      return page
  }
}
