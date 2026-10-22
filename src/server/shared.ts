import { Hono } from "hono";

export const newRouter = () => new Hono<{ Bindings: Env }>();
