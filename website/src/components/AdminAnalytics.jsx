import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { clearSession, isAdminSession } from '../utils/auth';
import { readAllOrders } from '../utils/dataTools';
import { hasNewEnquiriesAlert, hasNewOrdersAlert } from '../utils/adminAlerts';
import logo from '../assets/gsco-logo.svg';
import './Dashboard.css';
import './AdminAnalytics.css';

const formatMoney = (value) => `Rs. ${Number(value || 0).toFixed(2)}`;

const getMonthKey = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

const getMonthLabel = (date) =>
  date.toLocaleDateString('en-IN', {
    month: 'short',
    year: '2-digit'
  });

const getRecentMonths = (count) => {
  const now = new Date();
  const months = [];
  for (let offset = count - 1; offset >= 0; offset -= 1) {
    months.push(new Date(now.getFullYear(), now.getMonth() - offset, 1));
  }
  return months;
};

const adminQuestionSamples = [
  'Who is the top customer?',
  'Which month has highest sales?',
  'What is total sales?',
  'Which product is ordered most?'
];

const answerAdminQuestion = (question, analytics) => {
  const text = String(question || '').trim().toLowerCase();
  if (!text) {
    return 'Type a question to see analytics insights.';
  }

  const topCustomer = analytics.topCustomer;
  const topProduct = analytics.topProducts[0];
  const bestMonth = analytics.bestMonth;
  const worstMonth = analytics.worstMonth;
  const currentMonth = analytics.monthlySeries[analytics.monthlySeries.length - 1];

  if (text.includes('top customer') || text.includes('most ordering') || text.includes('who ordered')) {
    return topCustomer
      ? `${topCustomer.name} is the top customer with ${topCustomer.orders} orders (${formatMoney(topCustomer.spent)}).`
      : 'No customer order data available yet.';
  }

  if (text.includes('top product') || text.includes('most ordered product') || text.includes('best product')) {
    return topProduct
      ? `${topProduct.name} is the most ordered product with ${topProduct.quantity} units sold (${formatMoney(topProduct.revenue)}).`
      : 'No product order data available yet.';
  }

  if (text.includes('total sales') || text.includes('revenue')) {
    return `Total sales are ${formatMoney(analytics.totalRevenue)}.`;
  }

  if (text.includes('total orders') || text.includes('how many orders')) {
    return `Total orders placed: ${analytics.totalOrders}.`;
  }

  if (text.includes('average order')) {
    return analytics.totalOrders
      ? `Average order value is ${formatMoney(analytics.averageOrderValue)}.`
      : 'Average order value will be available after the first order.';
  }

  if (text.includes('highest sales') || text.includes('best month') || text.includes('peak month')) {
    return bestMonth && bestMonth.sales > 0
      ? `${bestMonth.label} is the highest sales month with ${formatMoney(bestMonth.sales)} from ${bestMonth.orders} orders.`
      : 'No monthly sales data available in the last 6 months.';
  }

  if (text.includes('lowest sales') || text.includes('least sales') || text.includes('worst month')) {
    return worstMonth
      ? `${worstMonth.label} is the lowest sales month with ${formatMoney(worstMonth.sales)} from ${worstMonth.orders} orders.`
      : 'No monthly sales data available in the last 6 months.';
  }

  if (text.includes('this month')) {
    return currentMonth
      ? `This month (${currentMonth.label}) sales: ${formatMoney(currentMonth.sales)} from ${currentMonth.orders} orders.`
      : 'No current month data available.';
  }

  const matchedMonth = analytics.monthlySeries.find((month) =>
    text.includes(month.label.toLowerCase().split(' ')[0])
  );
  if (matchedMonth) {
    return `${matchedMonth.label} sales: ${formatMoney(matchedMonth.sales)} from ${matchedMonth.orders} orders.`;
  }

  return 'I could not match that question. Try: top customer, total sales, highest sales month, average order value, or top product.';
};

function AdminAnalytics() {
  const navigate = useNavigate();
  const isAdmin = isAdminSession();
  const [question, setQuestion] = useState('');
  const [questionAnswer, setQuestionAnswer] = useState('');
  const [hasAsked, setHasAsked] = useState(false);
  const showOrdersDot = hasNewOrdersAlert();
  const showEnquiriesDot = hasNewEnquiriesAlert();

  useEffect(() => {
    if (!isAdmin) {
      navigate('/login');
    }
  }, [isAdmin, navigate]);

  const orders = useMemo(() => readAllOrders(), []);

  const analytics = useMemo(() => {
    const customerMap = new Map();
    const productMap = new Map();

    let totalRevenue = 0;
    let totalItems = 0;

    orders.forEach((order) => {
      const orderAmount = Number(order.totalAmount || 0);
      totalRevenue += orderAmount;

      const customerKey = order.email || order.name || 'Unknown customer';
      const customer = customerMap.get(customerKey) || {
        key: customerKey,
        name: order.name || order.email || 'Unknown customer',
        orders: 0,
        spent: 0
      };
      customer.orders += 1;
      customer.spent += orderAmount;
      customerMap.set(customerKey, customer);

      const items = Array.isArray(order.items) ? order.items : [];
      items.forEach((item) => {
        const quantity = Number(item.quantity || 0);
        const price = Number(item.price || 0);
        const productName = item.name || 'Unknown product';
        totalItems += quantity;

        const product = productMap.get(productName) || {
          name: productName,
          quantity: 0,
          revenue: 0
        };
        product.quantity += quantity;
        product.revenue += quantity * price;
        productMap.set(productName, product);
      });
    });

    const topCustomer = Array.from(customerMap.values()).sort((a, b) => {
      if (b.orders !== a.orders) return b.orders - a.orders;
      return b.spent - a.spent;
    })[0] || null;

    const topProducts = Array.from(productMap.values())
      .sort((a, b) => {
        if (b.quantity !== a.quantity) return b.quantity - a.quantity;
        return b.revenue - a.revenue;
      })
      .slice(0, 5);

    const recentMonths = getRecentMonths(6);
    const monthBuckets = new Map(
      recentMonths.map((month) => [getMonthKey(month), { orders: 0, sales: 0, label: getMonthLabel(month) }])
    );

    orders.forEach((order) => {
      const created = new Date(order.createdAt);
      if (Number.isNaN(created.getTime())) return;
      const key = getMonthKey(created);
      if (!monthBuckets.has(key)) return;
      const bucket = monthBuckets.get(key);
      bucket.orders += 1;
      bucket.sales += Number(order.totalAmount || 0);
    });

    const monthlySeries = recentMonths.map((month) => monthBuckets.get(getMonthKey(month)));
    const maxMonthlySales = Math.max(...monthlySeries.map((item) => item.sales), 0);

    const bestMonth = [...monthlySeries].sort((a, b) => b.sales - a.sales)[0] || null;
    const worstMonth = [...monthlySeries].sort((a, b) => a.sales - b.sales)[0] || null;
    const averageOrderValue = orders.length ? totalRevenue / orders.length : 0;
    const topProduct = topProducts[0] || null;

    return {
      totalRevenue,
      totalItems,
      totalOrders: orders.length,
      topCustomer,
      topProducts,
      monthlySeries,
      maxMonthlySales,
      bestMonth,
      worstMonth,
      averageOrderValue
    };
  }, [orders]);

  if (!isAdmin) return null;

  const handleLogout = () => {
    clearSession();
    navigate('/login');
  };

  const handleAskQuestion = () => {
    setHasAsked(true);
    setQuestionAnswer(answerAdminQuestion(question, analytics));
  };

  return (
    <div className="adminDash">
      <aside className="adminDash__sidebar">
        <div className="adminDash__brand">
          <div className="adminDash__logo">
            <img className="adminDash__logoImg" src={logo} alt="GS & Co logo" />
          </div>
          <div>
            <div className="adminDash__title">Admin Console</div>
            <div className="adminDash__subtitle">Govindasamy &amp; Co</div>
          </div>
        </div>
        <nav className="adminDash__nav" aria-label="Admin navigation">
          <button className="adminDash__navBtn" type="button" onClick={() => navigate('/admin/products')}>
            Manage Products
          </button>
          <button className="adminDash__navBtn" type="button" onClick={() => navigate('/admin/billing')}>
            Billing
          </button>
          <button className="adminDash__navBtn" type="button" onClick={() => navigate('/admin/orders')}>
            <span className="adminDash__navBtnLabel">
              Customer Orders
              {showOrdersDot && <span className="adminDash__navDot" />}
            </span>
          </button>
          <button className="adminDash__navBtn" type="button" onClick={() => navigate('/admin/enquiries')}>
            <span className="adminDash__navBtnLabel">
              Customer Enquiries
              {showEnquiriesDot && <span className="adminDash__navDot" />}
            </span>
          </button>
          <button className="adminDash__navBtn" type="button" onClick={() => navigate('/admin/analytics')}>
            Sales Analytics
          </button>
          <button className="adminDash__navBtn" type="button" onClick={() => navigate('/admin/import-export')}>
            Import / Export
          </button>
          <button className="adminDash__navBtn adminDash__navBtn--danger" type="button" onClick={handleLogout}>
            Logout
          </button>
        </nav>
        <div className="adminDash__meta">
          <span className="adminDash__chip">Secure Session</span>
          <span className="adminDash__metaText">Last sync: Today</span>
        </div>
      </aside>

      <main className="adminDash__main">
        <header className="adminDash__header">
          <div>
            <h1 className="adminDash__heading">Sales Analytics</h1>
            <p className="adminDash__lead">
              Track top ordering customers and monthly sales trends.
            </p>
          </div>
          <div className="adminDash__badge">Insights</div>
        </header>

        <section className="adminDash__stats" aria-label="Analytics summary">
          <article className="adminDash__card">
            <div className="adminDash__cardLabel">Total Orders</div>
            <div className="adminDash__cardValue">{analytics.totalOrders}</div>
            <div className="adminDash__cardHint">Orders received</div>
          </article>
          <article className="adminDash__card">
            <div className="adminDash__cardLabel">Total Sales</div>
            <div className="adminDash__cardValue adminAnalytics__money">{formatMoney(analytics.totalRevenue)}</div>
            <div className="adminDash__cardHint">Gross order revenue</div>
          </article>
          <article className="adminDash__card">
            <div className="adminDash__cardLabel">Top Ordering Person</div>
            <div className="adminDash__cardValue adminAnalytics__customerName">
              {analytics.topCustomer ? analytics.topCustomer.name : 'No orders yet'}
            </div>
            <div className="adminDash__cardHint">
              {analytics.topCustomer ? `${analytics.topCustomer.orders} orders` : 'Waiting for first order'}
            </div>
          </article>
        </section>

        <section className="adminDash__panel adminDash__panel--wide" aria-label="Monthly sales chart">
          <h2 className="adminDash__panelTitle">Monthly Sales (Last 6 Months)</h2>
          <p className="adminDash__panelText">Visual overview of order value and order count.</p>

          {analytics.totalOrders === 0 ? (
            <div className="adminAnalytics__empty">No order data available to generate charts yet.</div>
          ) : (
            <div className="adminAnalytics__chartWrap">
              <div className="adminAnalytics__chart">
                {analytics.monthlySeries.map((month) => {
                  const height =
                    analytics.maxMonthlySales > 0
                      ? Math.max((month.sales / analytics.maxMonthlySales) * 100, month.sales > 0 ? 10 : 2)
                      : 2;

                  return (
                    <div key={month.label} className="adminAnalytics__barGroup">
                      <div className="adminAnalytics__barTrack">
                        <div className="adminAnalytics__bar" style={{ height: `${height}%` }} />
                      </div>
                      <div className="adminAnalytics__barMeta">
                        <strong>{formatMoney(month.sales)}</strong>
                        <span>{month.orders} orders</span>
                      </div>
                      <div className="adminAnalytics__barLabel">{month.label}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        <section className="adminDash__panel adminDash__panel--wide" aria-label="Top products">
          <h2 className="adminDash__panelTitle">Top Ordered Products</h2>
          {analytics.topProducts.length === 0 ? (
            <p className="adminDash__panelText">No product-level sales data available yet.</p>
          ) : (
            <div className="adminAnalytics__tableWrap">
              <table className="adminAnalytics__table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Units Sold</th>
                    <th>Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.topProducts.map((product) => (
                    <tr key={product.name}>
                      <td>{product.name}</td>
                      <td>{product.quantity}</td>
                      <td>{formatMoney(product.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="adminDash__panel adminDash__panel--wide" aria-label="Ask admin analytics question">
          <h2 className="adminDash__panelTitle">Ask Analytics</h2>
          <p className="adminDash__panelText">Ask your own question about orders and sales.</p>

          <div className="adminAnalytics__askRow">
            <input
              type="text"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="Example: Which month has highest sales?"
            />
            <button type="button" onClick={handleAskQuestion}>Ask</button>
          </div>

          <div className="adminAnalytics__sampleQuestions">
            {adminQuestionSamples.map((sample) => (
              <button
                key={sample}
                type="button"
                className="adminAnalytics__sampleBtn"
                onClick={() => {
                  setQuestion(sample);
                  setHasAsked(false);
                  setQuestionAnswer('');
                }}
              >
                {sample}
              </button>
            ))}
          </div>

          {hasAsked && <div className="adminAnalytics__answerBox">{questionAnswer}</div>}
        </section>
      </main>
    </div>
  );
}

export default AdminAnalytics;
