import { regFileResponse } from "../../../lib/installer/download";

export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }): Promise<Response> {
  const { file } = await params;
  return regFileResponse(file);
}
