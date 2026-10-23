import type { APIRoute } from 'astro';
import { sdks } from '../../../data/sdks';
import { loadCoverageDetails } from '../../../lib/coverage';

// /data/coverage/<package>.json — подробности операций для раскрытых строк таблицы покрытия.
export const getStaticPaths = () =>
  sdks.filter((sdk) => sdk.coverage).map((sdk) => ({ params: { package: sdk.package }, props: { sdk } }));

export const GET: APIRoute = async ({ props }) =>
  new Response(JSON.stringify(await loadCoverageDetails(props.sdk)), {
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
