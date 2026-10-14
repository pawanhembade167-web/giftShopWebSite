interface IProduct {
  id: number;
  Name: string;
  Quantity: number;
  Price: number;
  Img?: string;
  Categoryid?: number;
  Factory?:string;
  Description?:string;
  Rating?: number;
  ReviewCount?: number;
}

export default IProduct;
