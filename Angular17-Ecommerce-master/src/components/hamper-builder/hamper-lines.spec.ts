import { addLine, hamperTotal, HamperDraftLine } from './hamper-lines';
import IProduct from '../../models/IProduct';

const candle: IProduct = { id: 1, Name: 'Candle', Quantity: 3, Price: 250 };

describe('hamperTotal', () => {
  it('adds up price times quantity for each line', () => {
    const lines: HamperDraftLine[] = [
      { product: candle, quantity: 2 },
      { product: { ...candle, id: 2, Price: 99.5 }, quantity: 1 },
    ];

    expect(hamperTotal(lines)).toBe(599.5);
  });
});

describe('addLine', () => {
  it('adds a new product with quantity one', () => {
    expect(addLine([], candle)).toEqual([{ product: candle, quantity: 1 }]);
  });

  it('adds one more of a product already in the hamper, up to the stock', () => {
    const lines = [{ product: candle, quantity: 2 }];

    expect(addLine(lines, candle)[0].quantity).toBe(3);
    expect(addLine([{ product: candle, quantity: 3 }], candle)[0].quantity).toBe(3);
  });
});
