/** Reference-image construction frame. Pixel correspondences are estimates, not measured source dimensions. */
export const REFERENCE_CAMERA = {projection:'orthographic' as const,yaw:35,pitch:32,fov:30,distance:1187.2185565683358,span:439.62574038941443,target:[-1.3908321550594702,63.90910349975804,59.6500331194116] as [number,number,number]};
/** Intersect a reference image ray with a chosen horizontal construction plane. */
export function referencePoint(px:number,py:number,y:number):[number,number,number]{
 const yaw=35*Math.PI/180,pitch=32*Math.PI/180,scale=1024/REFERENCE_CAMERA.span;
 const right=(px-768)/scale,up=(512-py)/scale,depth=(Math.cos(pitch)*(y-REFERENCE_CAMERA.target[1])-up)/Math.sin(pitch);
 return [Math.round(REFERENCE_CAMERA.target[0]+Math.cos(yaw)*right+Math.sin(yaw)*depth),y,Math.round(REFERENCE_CAMERA.target[2]-Math.sin(yaw)*right+Math.cos(yaw)*depth)];
}
export const REFERENCE_ORIGINS={ring:[-236,30,102],command:[-32,22,26],twins:[42,32,-11],sphere:[-64,22,230],industry:[-322,70,-53],airport:[93,90,-189],dragons:[284,22,55],workshop:[263,32,-43],greenhouses:[62,22,258],apartments:[-143,30,283],pavilions:[-30,20,331],temples:[86,26,71]} as const;
