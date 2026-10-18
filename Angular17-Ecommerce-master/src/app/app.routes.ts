import { Routes } from '@angular/router';
import { AboutusComponent } from '../components/aboutus/aboutus.component';
import { NotfoundpageComponent } from '../components/notfoundpage/notfoundpage.component';
import { ObsAndOperatorsComponent } from '../components/obs-and-operators/obs-and-operators.component';
import { LoginAuthComponent } from '../components/login-auth/login-auth.component';
import { UserAuthComponent } from '../components/user-auth/user-auth.component';
import { adminGuard } from '../Services/admin.guard';
import { authGuard } from '../Services/auth.guard';
// import { RecommendedProductComponent } from '../components/recommended-product/recommended-product.component';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('../components/storefront-home/storefront-home.component').then((m) => m.StorefrontHomeComponent),
    title: 'E-Gift Shopping'
  },
  // { path: 'home', component: ProductsParentComponent, title: 'Products' },
  {
    path: 'products',
    loadComponent: () => import('../components/catalog/catalog.component').then((m) => m.CatalogComponent),
    title: 'Shop all products'
  },
  {
    path: 'prd/:productID',
    loadComponent: () => import('../components/product-page/product-page.component').then((m) => m.ProductPageComponent),
    title: 'Product details'
  },
  // { path: 'details', component: ProudctDetailsComponent, title: 'Details' },
  {
    path: 'admin',
    canActivate: [adminGuard],
    loadComponent: () => import('../components/admin-pages/admin-shell.component').then((m) => m.AdminShellComponent),
    title: 'Store admin',
    children: [
      { path: '', loadComponent: () => import('../components/admin-pages/admin-dashboard.component').then((m) => m.AdminDashboardComponent), title: 'Admin dashboard' },
      { path: 'products', loadComponent: () => import('../components/admin-pages/admin-products.component').then((m) => m.AdminProductsComponent), title: 'Admin products' },
      { path: 'orders', loadComponent: () => import('../components/admin-pages/admin-orders.component').then((m) => m.AdminOrdersComponent), title: 'Admin orders' },
      { path: 'hampers', loadComponent: () => import('../components/admin-pages/admin-hampers.component').then((m) => m.AdminHampersComponent), title: 'Admin hamper requests' },
      { path: 'users', loadComponent: () => import('../components/admin-pages/admin-users.component').then((m) => m.AdminUsersComponent), title: 'Admin customers' },
    ],
  },
  { path: 'AboutUs', component: AboutusComponent, title: 'About Page' },
  { path: 'signup', component: LoginAuthComponent, title: 'Sign Up' },
  { path: 'login', component: UserAuthComponent, title: 'Login' },
  { path: 'Obs', component: ObsAndOperatorsComponent, title: 'Observer Page' },
  {
    path: 'cart',
    loadComponent: () => import('../components/cart-page/cart-page.component').then((m) => m.CartPageComponent),
    title: 'Your cart'
  },
  {
    path: 'wishlist',
    canActivate: [authGuard],
    loadComponent: () => import('../components/wishlist-page/wishlist-page.component').then((m) => m.WishlistPageComponent),
    title: 'Your wishlist'
  },
  {
    path: 'checkout',
    canActivate: [authGuard],
    loadComponent: () => import('../components/checkout-page/checkout-page.component').then((m) => m.CheckoutPageComponent),
    title: 'Checkout'
  },
  {
    path: 'orders',
    canActivate: [authGuard],
    loadComponent: () => import('../components/orders-page/orders-page.component').then((m) => m.OrdersPageComponent),
    title: 'My orders'
  },
  {
    path: 'orders/:orderId',
    canActivate: [authGuard],
    loadComponent: () => import('../components/order-detail-page/order-detail-page.component').then((m) => m.OrderDetailPageComponent),
    title: 'Order details'
  },
  // { path: 'recommended_product', component: RecommendedProductComponent, title: 'Recommended Product' },
  { path: '**', component: NotfoundpageComponent, title: 'Not found page' }
];
