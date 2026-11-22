interface RouteHandler {
  (req: { body: { orderId: string; total: number } }, res: { json: (body: unknown) => void }): Promise<void>;
}

interface Router {
  post(path: string, handler: RouteHandler): void;
}

interface Span {
  setAttribute(key: string, value: string): void;
  end(): void;
}

interface Tracer {
  startActiveSpan<T>(name: string, fn: (span: Span) => Promise<T>): Promise<T>;
}

declare const router: Router;
declare const tracer: Tracer;
declare class Worker {
  constructor(name: string, fn: (job: { data: { invoiceId: string } }) => Promise<void>);
}
declare function chargeCard(orderId: string, total: number): Promise<void>;
declare function refundOrder(orderId: string): Promise<void>;
declare function syncInvoice(invoiceId: string): Promise<void>;

router.post('/checkout', async (req, res) => {
  const orderId = req.body.orderId;
  const total = req.body.total;
  await chargeCard(orderId, total);
  res.json({ ok: true, orderId });
});

router.post('/refund', async (req, res) => {
  await tracer.startActiveSpan(`refund-${req.body.orderId}`, async (span) => {
    span.setAttribute('order.id', req.body.orderId);
    await refundOrder(req.body.orderId);
    span.end();
    res.json({ refunded: true });
  });
});

new Worker('invoice-sync', async (job) => {
  try {
    await syncInvoice(job.data.invoiceId);
  } catch (err) {
    return;
  }
});