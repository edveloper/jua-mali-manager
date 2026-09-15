-- The brand-relevant group: brands people often name, where the generic still works.
--
-- Different from the brand-led group that came before it. Nobody asks for "a
-- beer", so a Tusker row carries no word "beer". But people ask for "unga" as
-- readily as for "Jogoo", so these rows keep the product type in the name.
--
-- That is not only for reading. It is what stops brands colliding: Ndovu makes
-- maize flour, wheat flour and cement, Sunlight makes a powder, a bar and a
-- liquid, and Menengai makes both soap and cooking oil. Brand alone would put
-- three different things under one name.
--
-- The generic row stays alongside every branded one, as before. Most shops will
-- go on typing "unga" and meaning whatever is on the shelf that week.

-- Four rows in the previous migration spell the litre in lower case, which next
-- to a digit reads as another one: "Coca Cola 2l". Renamed rather than
-- reinserted, so the ids and anything already linked to them survive.
UPDATE public.canonical_products SET name = replace(name, '2l', '2L'), size_unit = 'L'
WHERE name IN ('Coca Cola 2l', 'Fanta Orange 2l', 'Sprite 2l');
UPDATE public.canonical_products SET name = '4th Street 1L', size_unit = 'L'
WHERE name = '4th Street 1l';

INSERT INTO public.canonical_products
  (name, product_type, brand, size_value, size_unit, sold_by, category, business_types, aliases)
VALUES
  ('Brookside Fresh Milk 500ml', 'Fresh Milk', 'Brookside', 500, 'ml', 'unit', 'Dairy', ARRAY['duka', 'mini_supermarket', 'poultry_dairy'], ARRAY['brookside', 'brookside 500ml']),
  ('Brookside Fresh Milk 1L', 'Fresh Milk', 'Brookside', 1, 'L', 'unit', 'Dairy', ARRAY['duka', 'mini_supermarket', 'poultry_dairy'], ARRAY['brookside', 'brookside 1L']),
  ('Tuzo Fresh Milk 500ml', 'Fresh Milk', 'Tuzo', 500, 'ml', 'unit', 'Dairy', ARRAY['duka', 'mini_supermarket', 'poultry_dairy'], ARRAY['tuzo', 'tuzo 500ml']),
  ('Tuzo Fresh Milk 1L', 'Fresh Milk', 'Tuzo', 1, 'L', 'unit', 'Dairy', ARRAY['duka', 'mini_supermarket', 'poultry_dairy'], ARRAY['tuzo', 'tuzo 1L']),
  ('KCC Fresh Milk 500ml', 'Fresh Milk', 'KCC', 500, 'ml', 'unit', 'Dairy', ARRAY['duka', 'mini_supermarket', 'poultry_dairy'], ARRAY['gold crown', 'kcc', 'kcc 500ml', 'new kcc']),
  ('KCC Fresh Milk 1L', 'Fresh Milk', 'KCC', 1, 'L', 'unit', 'Dairy', ARRAY['duka', 'mini_supermarket', 'poultry_dairy'], ARRAY['gold crown', 'kcc', 'kcc 1L', 'new kcc']),
  ('Ilara Fresh Milk 500ml', 'Fresh Milk', 'Ilara', 500, 'ml', 'unit', 'Dairy', ARRAY['duka', 'mini_supermarket', 'poultry_dairy'], ARRAY['ilara', 'ilara 500ml']),
  ('Ilara Fresh Milk 1L', 'Fresh Milk', 'Ilara', 1, 'L', 'unit', 'Dairy', ARRAY['duka', 'mini_supermarket', 'poultry_dairy'], ARRAY['ilara', 'ilara 1L']),
  ('Daima Fresh Milk 500ml', 'Fresh Milk', 'Daima', 500, 'ml', 'unit', 'Dairy', ARRAY['duka', 'mini_supermarket', 'poultry_dairy'], ARRAY['daima', 'daima 500ml']),
  ('Daima Fresh Milk 1L', 'Fresh Milk', 'Daima', 1, 'L', 'unit', 'Dairy', ARRAY['duka', 'mini_supermarket', 'poultry_dairy'], ARRAY['daima', 'daima 1L']),
  ('Fresha Fresh Milk 500ml', 'Fresh Milk', 'Fresha', 500, 'ml', 'unit', 'Dairy', ARRAY['duka', 'mini_supermarket', 'poultry_dairy'], ARRAY['fresha', 'fresha 500ml']),
  ('Fresha Fresh Milk 1L', 'Fresh Milk', 'Fresha', 1, 'L', 'unit', 'Dairy', ARRAY['duka', 'mini_supermarket', 'poultry_dairy'], ARRAY['fresha', 'fresha 1L']),
  ('Molo Milk Fresh Milk 500ml', 'Fresh Milk', 'Molo Milk', 500, 'ml', 'unit', 'Dairy', ARRAY['duka', 'mini_supermarket', 'poultry_dairy'], ARRAY['molo', 'molo 500ml', 'molo milk']),
  ('Molo Milk Fresh Milk 1L', 'Fresh Milk', 'Molo Milk', 1, 'L', 'unit', 'Dairy', ARRAY['duka', 'mini_supermarket', 'poultry_dairy'], ARRAY['molo', 'molo 1L', 'molo milk']),
  ('Lato Fresh Milk 500ml', 'Fresh Milk', 'Lato', 500, 'ml', 'unit', 'Dairy', ARRAY['duka', 'mini_supermarket', 'poultry_dairy'], ARRAY['lato', 'lato 500ml']),
  ('Lato Fresh Milk 1L', 'Fresh Milk', 'Lato', 1, 'L', 'unit', 'Dairy', ARRAY['duka', 'mini_supermarket', 'poultry_dairy'], ARRAY['lato', 'lato 1L']),
  ('Brookside Long Life Milk 500ml', 'Long Life Milk', 'Brookside', 500, 'ml', 'unit', 'Dairy', ARRAY['duka', 'mini_supermarket'], ARRAY['brookside uht', 'brookside uht 500ml']),
  ('Brookside Long Life Milk 1L', 'Long Life Milk', 'Brookside', 1, 'L', 'unit', 'Dairy', ARRAY['duka', 'mini_supermarket'], ARRAY['brookside uht', 'brookside uht 1L']),
  ('KCC Long Life Milk 500ml', 'Long Life Milk', 'KCC', 500, 'ml', 'unit', 'Dairy', ARRAY['duka', 'mini_supermarket'], ARRAY['kcc long life', 'kcc long life 500ml']),
  ('KCC Long Life Milk 1L', 'Long Life Milk', 'KCC', 1, 'L', 'unit', 'Dairy', ARRAY['duka', 'mini_supermarket'], ARRAY['kcc long life', 'kcc long life 1L']),
  ('Lato Long Life Milk 500ml', 'Long Life Milk', 'Lato', 500, 'ml', 'unit', 'Dairy', ARRAY['duka', 'mini_supermarket'], ARRAY['lato uht', 'lato uht 500ml']),
  ('Lato Long Life Milk 1L', 'Long Life Milk', 'Lato', 1, 'L', 'unit', 'Dairy', ARRAY['duka', 'mini_supermarket'], ARRAY['lato uht', 'lato uht 1L']),
  ('Brookside Fermented Milk 500ml', 'Fermented Milk', 'Brookside', 500, 'ml', 'unit', 'Dairy', ARRAY['duka', 'mini_supermarket', 'poultry_dairy'], ARRAY['brookside mala', 'brookside mala 500ml']),
  ('Tuzo Fermented Milk 500ml', 'Fermented Milk', 'Tuzo', 500, 'ml', 'unit', 'Dairy', ARRAY['duka', 'mini_supermarket', 'poultry_dairy'], ARRAY['tuzo mala', 'tuzo mala 500ml']),
  ('Daima Fermented Milk 500ml', 'Fermented Milk', 'Daima', 500, 'ml', 'unit', 'Dairy', ARRAY['duka', 'mini_supermarket', 'poultry_dairy'], ARRAY['daima mala', 'daima mala 500ml']),
  ('Brookside Yoghurt 250ml', 'Yoghurt', 'Brookside', 250, 'ml', 'unit', 'Dairy', ARRAY['duka', 'mini_supermarket'], ARRAY['brookside yoghurt', 'brookside yoghurt 250ml']),
  ('Brookside Yoghurt 500ml', 'Yoghurt', 'Brookside', 500, 'ml', 'unit', 'Dairy', ARRAY['duka', 'mini_supermarket'], ARRAY['brookside yoghurt', 'brookside yoghurt 500ml']),
  ('Daima Yoghurt 250ml', 'Yoghurt', 'Daima', 250, 'ml', 'unit', 'Dairy', ARRAY['duka', 'mini_supermarket'], ARRAY['daima yoghurt', 'daima yoghurt 250ml']),
  ('Daima Yoghurt 500ml', 'Yoghurt', 'Daima', 500, 'ml', 'unit', 'Dairy', ARRAY['duka', 'mini_supermarket'], ARRAY['daima yoghurt', 'daima yoghurt 500ml']),
  ('Bio Foods Yoghurt 250ml', 'Yoghurt', 'Bio Foods', 250, 'ml', 'unit', 'Dairy', ARRAY['duka', 'mini_supermarket'], ARRAY['bio', 'bio 250ml', 'bio foods']),
  ('Bio Foods Yoghurt 500ml', 'Yoghurt', 'Bio Foods', 500, 'ml', 'unit', 'Dairy', ARRAY['duka', 'mini_supermarket'], ARRAY['bio', 'bio 500ml', 'bio foods']),
  ('Blue Band Margarine 250g', 'Margarine', 'Blue Band', 250, 'g', 'unit', 'Dairy', ARRAY['duka', 'mini_supermarket'], ARRAY['blue band', 'blueband', 'blueband 250g']),
  ('Blue Band Margarine 500g', 'Margarine', 'Blue Band', 500, 'g', 'unit', 'Dairy', ARRAY['duka', 'mini_supermarket'], ARRAY['blue band', 'blueband', 'blueband 500g']),
  ('Prestige Margarine 250g', 'Margarine', 'Prestige', 250, 'g', 'unit', 'Dairy', ARRAY['duka', 'mini_supermarket'], ARRAY['prestige', 'prestige 250g']),
  ('Prestige Margarine 500g', 'Margarine', 'Prestige', 500, 'g', 'unit', 'Dairy', ARRAY['duka', 'mini_supermarket'], ARRAY['prestige', 'prestige 500g']),
  ('Supa Loaf Bread 400g', 'Bread', 'Supa Loaf', 400, 'g', 'unit', 'Bakery', ARRAY['bakery', 'duka', 'mini_supermarket'], ARRAY['supa loaf', 'supa loaf 400g', 'supaloaf']),
  ('Supa Loaf Bread 800g', 'Bread', 'Supa Loaf', 800, 'g', 'unit', 'Bakery', ARRAY['bakery', 'duka', 'mini_supermarket'], ARRAY['supa loaf', 'supa loaf 800g', 'supaloaf']),
  ('Festive Bread 400g', 'Bread', 'Festive', 400, 'g', 'unit', 'Bakery', ARRAY['bakery', 'duka', 'mini_supermarket'], ARRAY['festive', 'festive 400g']),
  ('Festive Bread 800g', 'Bread', 'Festive', 800, 'g', 'unit', 'Bakery', ARRAY['bakery', 'duka', 'mini_supermarket'], ARRAY['festive', 'festive 800g']),
  ('Broadways Bread 400g', 'Bread', 'Broadways', 400, 'g', 'unit', 'Bakery', ARRAY['bakery', 'duka', 'mini_supermarket'], ARRAY['broadways', 'broadways 400g', 'brodways']),
  ('Broadways Bread 800g', 'Bread', 'Broadways', 800, 'g', 'unit', 'Bakery', ARRAY['bakery', 'duka', 'mini_supermarket'], ARRAY['broadways', 'broadways 800g', 'brodways']),
  ('Elliots Bread 400g', 'Bread', 'Elliots', 400, 'g', 'unit', 'Bakery', ARRAY['bakery', 'duka', 'mini_supermarket'], ARRAY['elliot', 'elliots', 'elliots 400g']),
  ('Elliots Bread 800g', 'Bread', 'Elliots', 800, 'g', 'unit', 'Bakery', ARRAY['bakery', 'duka', 'mini_supermarket'], ARRAY['elliot', 'elliots', 'elliots 800g']),
  ('United Millers Bread 400g', 'Bread', 'United Millers', 400, 'g', 'unit', 'Bakery', ARRAY['bakery', 'duka', 'mini_supermarket'], ARRAY['united millers', 'united millers 400g']),
  ('United Millers Bread 800g', 'Bread', 'United Millers', 800, 'g', 'unit', 'Bakery', ARRAY['bakery', 'duka', 'mini_supermarket'], ARRAY['united millers', 'united millers 800g']),
  ('Jogoo Maize Flour 1kg', 'Maize Flour', 'Jogoo', 1, 'kg', 'unit', 'Staples', ARRAY['duka', 'grains_store', 'mini_supermarket'], ARRAY['jogoo', 'jogoo 1kg']),
  ('Jogoo Maize Flour 2kg', 'Maize Flour', 'Jogoo', 2, 'kg', 'unit', 'Staples', ARRAY['duka', 'grains_store', 'mini_supermarket'], ARRAY['jogoo', 'jogoo 2kg']),
  ('Pembe Maize Flour 1kg', 'Maize Flour', 'Pembe', 1, 'kg', 'unit', 'Staples', ARRAY['duka', 'grains_store', 'mini_supermarket'], ARRAY['pembe', 'pembe 1kg']),
  ('Pembe Maize Flour 2kg', 'Maize Flour', 'Pembe', 2, 'kg', 'unit', 'Staples', ARRAY['duka', 'grains_store', 'mini_supermarket'], ARRAY['pembe', 'pembe 2kg']),
  ('Soko Maize Flour 1kg', 'Maize Flour', 'Soko', 1, 'kg', 'unit', 'Staples', ARRAY['duka', 'grains_store', 'mini_supermarket'], ARRAY['soko', 'soko 1kg']),
  ('Soko Maize Flour 2kg', 'Maize Flour', 'Soko', 2, 'kg', 'unit', 'Staples', ARRAY['duka', 'grains_store', 'mini_supermarket'], ARRAY['soko', 'soko 2kg']),
  ('Dola Maize Flour 1kg', 'Maize Flour', 'Dola', 1, 'kg', 'unit', 'Staples', ARRAY['duka', 'grains_store', 'mini_supermarket'], ARRAY['dola', 'dola 1kg']),
  ('Dola Maize Flour 2kg', 'Maize Flour', 'Dola', 2, 'kg', 'unit', 'Staples', ARRAY['duka', 'grains_store', 'mini_supermarket'], ARRAY['dola', 'dola 2kg']),
  ('Hostess Maize Flour 1kg', 'Maize Flour', 'Hostess', 1, 'kg', 'unit', 'Staples', ARRAY['duka', 'grains_store', 'mini_supermarket'], ARRAY['hostess', 'hostess 1kg']),
  ('Hostess Maize Flour 2kg', 'Maize Flour', 'Hostess', 2, 'kg', 'unit', 'Staples', ARRAY['duka', 'grains_store', 'mini_supermarket'], ARRAY['hostess', 'hostess 2kg']),
  ('Ndovu Maize Flour 1kg', 'Maize Flour', 'Ndovu', 1, 'kg', 'unit', 'Staples', ARRAY['duka', 'grains_store', 'mini_supermarket'], ARRAY['ndovu', 'ndovu 1kg']),
  ('Ndovu Maize Flour 2kg', 'Maize Flour', 'Ndovu', 2, 'kg', 'unit', 'Staples', ARRAY['duka', 'grains_store', 'mini_supermarket'], ARRAY['ndovu', 'ndovu 2kg']),
  ('Jimbi Maize Flour 1kg', 'Maize Flour', 'Jimbi', 1, 'kg', 'unit', 'Staples', ARRAY['duka', 'grains_store', 'mini_supermarket'], ARRAY['jimbi', 'jimbi 1kg']),
  ('Jimbi Maize Flour 2kg', 'Maize Flour', 'Jimbi', 2, 'kg', 'unit', 'Staples', ARRAY['duka', 'grains_store', 'mini_supermarket'], ARRAY['jimbi', 'jimbi 2kg']),
  ('Amaize Maize Flour 1kg', 'Maize Flour', 'Amaize', 1, 'kg', 'unit', 'Staples', ARRAY['duka', 'grains_store', 'mini_supermarket'], ARRAY['amaize', 'amaize 1kg']),
  ('Amaize Maize Flour 2kg', 'Maize Flour', 'Amaize', 2, 'kg', 'unit', 'Staples', ARRAY['duka', 'grains_store', 'mini_supermarket'], ARRAY['amaize', 'amaize 2kg']),
  ('Kifaru Maize Flour 1kg', 'Maize Flour', 'Kifaru', 1, 'kg', 'unit', 'Staples', ARRAY['duka', 'grains_store', 'mini_supermarket'], ARRAY['kifaru', 'kifaru 1kg']),
  ('Kifaru Maize Flour 2kg', 'Maize Flour', 'Kifaru', 2, 'kg', 'unit', 'Staples', ARRAY['duka', 'grains_store', 'mini_supermarket'], ARRAY['kifaru', 'kifaru 2kg']),
  ('Taifa Maize Flour 1kg', 'Maize Flour', 'Taifa', 1, 'kg', 'unit', 'Staples', ARRAY['duka', 'grains_store', 'mini_supermarket'], ARRAY['taifa', 'taifa 1kg']),
  ('Taifa Maize Flour 2kg', 'Maize Flour', 'Taifa', 2, 'kg', 'unit', 'Staples', ARRAY['duka', 'grains_store', 'mini_supermarket'], ARRAY['taifa', 'taifa 2kg']),
  ('Exe Wheat Flour 1kg', 'Wheat Flour', 'Exe', 1, 'kg', 'unit', 'Staples', ARRAY['duka', 'grains_store', 'mini_supermarket'], ARRAY['exe', 'exe 1kg']),
  ('Exe Wheat Flour 2kg', 'Wheat Flour', 'Exe', 2, 'kg', 'unit', 'Staples', ARRAY['duka', 'grains_store', 'mini_supermarket'], ARRAY['exe', 'exe 2kg']),
  ('Ndovu Wheat Flour 1kg', 'Wheat Flour', 'Ndovu', 1, 'kg', 'unit', 'Staples', ARRAY['duka', 'grains_store', 'mini_supermarket'], ARRAY['ndovu ngano', 'ndovu ngano 1kg']),
  ('Ndovu Wheat Flour 2kg', 'Wheat Flour', 'Ndovu', 2, 'kg', 'unit', 'Staples', ARRAY['duka', 'grains_store', 'mini_supermarket'], ARRAY['ndovu ngano', 'ndovu ngano 2kg']),
  ('Pembe Wheat Flour 1kg', 'Wheat Flour', 'Pembe', 1, 'kg', 'unit', 'Staples', ARRAY['duka', 'grains_store', 'mini_supermarket'], ARRAY['pembe ngano', 'pembe ngano 1kg']),
  ('Pembe Wheat Flour 2kg', 'Wheat Flour', 'Pembe', 2, 'kg', 'unit', 'Staples', ARRAY['duka', 'grains_store', 'mini_supermarket'], ARRAY['pembe ngano', 'pembe ngano 2kg']),
  ('Ajab Wheat Flour 1kg', 'Wheat Flour', 'Ajab', 1, 'kg', 'unit', 'Staples', ARRAY['duka', 'grains_store', 'mini_supermarket'], ARRAY['ajab', 'ajab 1kg']),
  ('Ajab Wheat Flour 2kg', 'Wheat Flour', 'Ajab', 2, 'kg', 'unit', 'Staples', ARRAY['duka', 'grains_store', 'mini_supermarket'], ARRAY['ajab', 'ajab 2kg']),
  ('Taifa Wheat Flour 1kg', 'Wheat Flour', 'Taifa', 1, 'kg', 'unit', 'Staples', ARRAY['duka', 'grains_store', 'mini_supermarket'], ARRAY['taifa ngano', 'taifa ngano 1kg']),
  ('Taifa Wheat Flour 2kg', 'Wheat Flour', 'Taifa', 2, 'kg', 'unit', 'Staples', ARRAY['duka', 'grains_store', 'mini_supermarket'], ARRAY['taifa ngano', 'taifa ngano 2kg']),
  ('Daawat Rice 1kg', 'Rice', 'Daawat', 1, 'kg', 'unit', 'Staples', ARRAY['duka', 'grains_store', 'mini_supermarket'], ARRAY['daawat', 'daawat 1kg']),
  ('Daawat Rice 2kg', 'Rice', 'Daawat', 2, 'kg', 'unit', 'Staples', ARRAY['duka', 'grains_store', 'mini_supermarket'], ARRAY['daawat', 'daawat 2kg']),
  ('Sunrice Rice 1kg', 'Rice', 'Sunrice', 1, 'kg', 'unit', 'Staples', ARRAY['duka', 'grains_store', 'mini_supermarket'], ARRAY['sunrice', 'sunrice 1kg']),
  ('Sunrice Rice 2kg', 'Rice', 'Sunrice', 2, 'kg', 'unit', 'Staples', ARRAY['duka', 'grains_store', 'mini_supermarket'], ARRAY['sunrice', 'sunrice 2kg']),
  ('Ranee Rice 1kg', 'Rice', 'Ranee', 1, 'kg', 'unit', 'Staples', ARRAY['duka', 'grains_store', 'mini_supermarket'], ARRAY['ranee', 'ranee 1kg']),
  ('Ranee Rice 2kg', 'Rice', 'Ranee', 2, 'kg', 'unit', 'Staples', ARRAY['duka', 'grains_store', 'mini_supermarket'], ARRAY['ranee', 'ranee 2kg']),
  ('Mwea Rice 1kg', 'Rice', 'Mwea', 1, 'kg', 'unit', 'Staples', ARRAY['duka', 'grains_store', 'mini_supermarket'], ARRAY['mwea', 'mwea 1kg', 'mwea pishori']),
  ('Mwea Rice 2kg', 'Rice', 'Mwea', 2, 'kg', 'unit', 'Staples', ARRAY['duka', 'grains_store', 'mini_supermarket'], ARRAY['mwea', 'mwea 2kg', 'mwea pishori']),
  ('Fresh Fri Cooking Oil 1L', 'Cooking Oil', 'Fresh Fri', 1, 'L', 'unit', 'Staples', ARRAY['duka', 'mini_supermarket'], ARRAY['fresh fri', 'fresh fri 1L', 'freshfri']),
  ('Fresh Fri Cooking Oil 2L', 'Cooking Oil', 'Fresh Fri', 2, 'L', 'unit', 'Staples', ARRAY['duka', 'mini_supermarket'], ARRAY['fresh fri', 'fresh fri 2L', 'freshfri']),
  ('Elianto Cooking Oil 1L', 'Cooking Oil', 'Elianto', 1, 'L', 'unit', 'Staples', ARRAY['duka', 'mini_supermarket'], ARRAY['elianto', 'elianto 1L']),
  ('Elianto Cooking Oil 2L', 'Cooking Oil', 'Elianto', 2, 'L', 'unit', 'Staples', ARRAY['duka', 'mini_supermarket'], ARRAY['elianto', 'elianto 2L']),
  ('Rina Cooking Oil 1L', 'Cooking Oil', 'Rina', 1, 'L', 'unit', 'Staples', ARRAY['duka', 'mini_supermarket'], ARRAY['rina', 'rina 1L']),
  ('Rina Cooking Oil 2L', 'Cooking Oil', 'Rina', 2, 'L', 'unit', 'Staples', ARRAY['duka', 'mini_supermarket'], ARRAY['rina', 'rina 2L']),
  ('Salit Cooking Oil 1L', 'Cooking Oil', 'Salit', 1, 'L', 'unit', 'Staples', ARRAY['duka', 'mini_supermarket'], ARRAY['salit', 'salit 1L']),
  ('Salit Cooking Oil 2L', 'Cooking Oil', 'Salit', 2, 'L', 'unit', 'Staples', ARRAY['duka', 'mini_supermarket'], ARRAY['salit', 'salit 2L']),
  ('Golden Fry Cooking Oil 1L', 'Cooking Oil', 'Golden Fry', 1, 'L', 'unit', 'Staples', ARRAY['duka', 'mini_supermarket'], ARRAY['golden fry', 'golden fry 1L']),
  ('Golden Fry Cooking Oil 2L', 'Cooking Oil', 'Golden Fry', 2, 'L', 'unit', 'Staples', ARRAY['duka', 'mini_supermarket'], ARRAY['golden fry', 'golden fry 2L']),
  ('Postman Cooking Oil 1L', 'Cooking Oil', 'Postman', 1, 'L', 'unit', 'Staples', ARRAY['duka', 'mini_supermarket'], ARRAY['postman', 'postman 1L']),
  ('Postman Cooking Oil 2L', 'Cooking Oil', 'Postman', 2, 'L', 'unit', 'Staples', ARRAY['duka', 'mini_supermarket'], ARRAY['postman', 'postman 2L']),
  ('Sunfoil Cooking Oil 1L', 'Cooking Oil', 'Sunfoil', 1, 'L', 'unit', 'Staples', ARRAY['duka', 'mini_supermarket'], ARRAY['sunfoil', 'sunfoil 1L']),
  ('Sunfoil Cooking Oil 2L', 'Cooking Oil', 'Sunfoil', 2, 'L', 'unit', 'Staples', ARRAY['duka', 'mini_supermarket'], ARRAY['sunfoil', 'sunfoil 2L']),
  ('Menengai Cooking Oil 1L', 'Cooking Oil', 'Menengai', 1, 'L', 'unit', 'Staples', ARRAY['duka', 'mini_supermarket'], ARRAY['menengai oil', 'menengai oil 1L']),
  ('Menengai Cooking Oil 2L', 'Cooking Oil', 'Menengai', 2, 'L', 'unit', 'Staples', ARRAY['duka', 'mini_supermarket'], ARRAY['menengai oil', 'menengai oil 2L']),
  ('Kimbo Cooking Fat 250g', 'Cooking Fat', 'Kimbo', 250, 'g', 'unit', 'Staples', ARRAY['duka', 'mini_supermarket'], ARRAY['kimbo', 'kimbo 250g']),
  ('Kimbo Cooking Fat 500g', 'Cooking Fat', 'Kimbo', 500, 'g', 'unit', 'Staples', ARRAY['duka', 'mini_supermarket'], ARRAY['kimbo', 'kimbo 500g']),
  ('Kasuku Cooking Fat 250g', 'Cooking Fat', 'Kasuku', 250, 'g', 'unit', 'Staples', ARRAY['duka', 'mini_supermarket'], ARRAY['kasuku', 'kasuku 250g']),
  ('Kasuku Cooking Fat 500g', 'Cooking Fat', 'Kasuku', 500, 'g', 'unit', 'Staples', ARRAY['duka', 'mini_supermarket'], ARRAY['kasuku', 'kasuku 500g']),
  ('Chipsy Cooking Fat 250g', 'Cooking Fat', 'Chipsy', 250, 'g', 'unit', 'Staples', ARRAY['duka', 'mini_supermarket'], ARRAY['chipsy', 'chipsy 250g']),
  ('Chipsy Cooking Fat 500g', 'Cooking Fat', 'Chipsy', 500, 'g', 'unit', 'Staples', ARRAY['duka', 'mini_supermarket'], ARRAY['chipsy', 'chipsy 500g']),
  ('Tussy Cooking Fat 250g', 'Cooking Fat', 'Tussy', 250, 'g', 'unit', 'Staples', ARRAY['duka', 'mini_supermarket'], ARRAY['tussy', 'tussy 250g']),
  ('Tussy Cooking Fat 500g', 'Cooking Fat', 'Tussy', 500, 'g', 'unit', 'Staples', ARRAY['duka', 'mini_supermarket'], ARRAY['tussy', 'tussy 500g']),
  ('Mumias Sugar 1kg', 'Sugar', 'Mumias', 1, 'kg', 'unit', 'Staples', ARRAY['duka', 'mini_supermarket'], ARRAY['mumias', 'mumias 1kg']),
  ('Mumias Sugar 2kg', 'Sugar', 'Mumias', 2, 'kg', 'unit', 'Staples', ARRAY['duka', 'mini_supermarket'], ARRAY['mumias', 'mumias 2kg']),
  ('Kabras Sugar 1kg', 'Sugar', 'Kabras', 1, 'kg', 'unit', 'Staples', ARRAY['duka', 'mini_supermarket'], ARRAY['kabras', 'kabras 1kg']),
  ('Kabras Sugar 2kg', 'Sugar', 'Kabras', 2, 'kg', 'unit', 'Staples', ARRAY['duka', 'mini_supermarket'], ARRAY['kabras', 'kabras 2kg']),
  ('Sony Sugar 1kg', 'Sugar', 'Sony', 1, 'kg', 'unit', 'Staples', ARRAY['duka', 'mini_supermarket'], ARRAY['sony', 'sony 1kg']),
  ('Sony Sugar 2kg', 'Sugar', 'Sony', 2, 'kg', 'unit', 'Staples', ARRAY['duka', 'mini_supermarket'], ARRAY['sony', 'sony 2kg']),
  ('Nzoia Sugar 1kg', 'Sugar', 'Nzoia', 1, 'kg', 'unit', 'Staples', ARRAY['duka', 'mini_supermarket'], ARRAY['nzoia', 'nzoia 1kg']),
  ('Nzoia Sugar 2kg', 'Sugar', 'Nzoia', 2, 'kg', 'unit', 'Staples', ARRAY['duka', 'mini_supermarket'], ARRAY['nzoia', 'nzoia 2kg']),
  ('Butali Sugar 1kg', 'Sugar', 'Butali', 1, 'kg', 'unit', 'Staples', ARRAY['duka', 'mini_supermarket'], ARRAY['butali', 'butali 1kg']),
  ('Butali Sugar 2kg', 'Sugar', 'Butali', 2, 'kg', 'unit', 'Staples', ARRAY['duka', 'mini_supermarket'], ARRAY['butali', 'butali 2kg']),
  ('Transmara Sugar 1kg', 'Sugar', 'Transmara', 1, 'kg', 'unit', 'Staples', ARRAY['duka', 'mini_supermarket'], ARRAY['transmara', 'transmara 1kg']),
  ('Transmara Sugar 2kg', 'Sugar', 'Transmara', 2, 'kg', 'unit', 'Staples', ARRAY['duka', 'mini_supermarket'], ARRAY['transmara', 'transmara 2kg']),
  ('Kensalt Salt 500g', 'Salt', 'Kensalt', 500, 'g', 'unit', 'Staples', ARRAY['duka', 'mini_supermarket'], ARRAY['kensalt', 'kensalt 500g']),
  ('Kay Salt Salt 500g', 'Salt', 'Kay Salt', 500, 'g', 'unit', 'Staples', ARRAY['duka', 'mini_supermarket'], ARRAY['kay', 'kay salt', 'kay salt 500g']),
  ('Ketepa Tea Leaves 100g', 'Tea Leaves', 'Ketepa', 100, 'g', 'unit', 'Drinks', ARRAY['duka', 'mini_supermarket'], ARRAY['ketepa', 'ketepa 100g', 'ketepa pride']),
  ('Ketepa Tea Leaves 250g', 'Tea Leaves', 'Ketepa', 250, 'g', 'unit', 'Drinks', ARRAY['duka', 'mini_supermarket'], ARRAY['ketepa', 'ketepa 250g', 'ketepa pride']),
  ('Ketepa Tea Leaves 500g', 'Tea Leaves', 'Ketepa', 500, 'g', 'unit', 'Drinks', ARRAY['duka', 'mini_supermarket'], ARRAY['ketepa', 'ketepa 500g', 'ketepa pride']),
  ('Kericho Gold Tea Leaves 100g', 'Tea Leaves', 'Kericho Gold', 100, 'g', 'unit', 'Drinks', ARRAY['duka', 'mini_supermarket'], ARRAY['kericho', 'kericho gold', 'kericho gold 100g']),
  ('Kericho Gold Tea Leaves 250g', 'Tea Leaves', 'Kericho Gold', 250, 'g', 'unit', 'Drinks', ARRAY['duka', 'mini_supermarket'], ARRAY['kericho', 'kericho gold', 'kericho gold 250g']),
  ('Kericho Gold Tea Leaves 500g', 'Tea Leaves', 'Kericho Gold', 500, 'g', 'unit', 'Drinks', ARRAY['duka', 'mini_supermarket'], ARRAY['kericho', 'kericho gold', 'kericho gold 500g']),
  ('Fahari Tea Leaves 100g', 'Tea Leaves', 'Fahari', 100, 'g', 'unit', 'Drinks', ARRAY['duka', 'mini_supermarket'], ARRAY['fahari', 'fahari 100g']),
  ('Fahari Tea Leaves 250g', 'Tea Leaves', 'Fahari', 250, 'g', 'unit', 'Drinks', ARRAY['duka', 'mini_supermarket'], ARRAY['fahari', 'fahari 250g']),
  ('Fahari Tea Leaves 500g', 'Tea Leaves', 'Fahari', 500, 'g', 'unit', 'Drinks', ARRAY['duka', 'mini_supermarket'], ARRAY['fahari', 'fahari 500g']),
  ('Melvins Tea Leaves 100g', 'Tea Leaves', 'Melvins', 100, 'g', 'unit', 'Drinks', ARRAY['duka', 'mini_supermarket'], ARRAY['melvins', 'melvins 100g']),
  ('Melvins Tea Leaves 250g', 'Tea Leaves', 'Melvins', 250, 'g', 'unit', 'Drinks', ARRAY['duka', 'mini_supermarket'], ARRAY['melvins', 'melvins 250g']),
  ('Melvins Tea Leaves 500g', 'Tea Leaves', 'Melvins', 500, 'g', 'unit', 'Drinks', ARRAY['duka', 'mini_supermarket'], ARRAY['melvins', 'melvins 500g']),
  ('Safari Tea Leaves 100g', 'Tea Leaves', 'Safari', 100, 'g', 'unit', 'Drinks', ARRAY['duka', 'mini_supermarket'], ARRAY['safari tea', 'safari tea 100g']),
  ('Safari Tea Leaves 250g', 'Tea Leaves', 'Safari', 250, 'g', 'unit', 'Drinks', ARRAY['duka', 'mini_supermarket'], ARRAY['safari tea', 'safari tea 250g']),
  ('Safari Tea Leaves 500g', 'Tea Leaves', 'Safari', 500, 'g', 'unit', 'Drinks', ARRAY['duka', 'mini_supermarket'], ARRAY['safari tea', 'safari tea 500g']),
  ('Omo Washing Powder 500g', 'Washing Powder', 'Omo', 500, 'g', 'unit', 'Household', ARRAY['duka', 'mini_supermarket'], ARRAY['omo', 'omo 500g']),
  ('Omo Washing Powder 1kg', 'Washing Powder', 'Omo', 1, 'kg', 'unit', 'Household', ARRAY['duka', 'mini_supermarket'], ARRAY['omo', 'omo 1kg']),
  ('Toss Washing Powder 500g', 'Washing Powder', 'Toss', 500, 'g', 'unit', 'Household', ARRAY['duka', 'mini_supermarket'], ARRAY['toss', 'toss 500g']),
  ('Toss Washing Powder 1kg', 'Washing Powder', 'Toss', 1, 'kg', 'unit', 'Household', ARRAY['duka', 'mini_supermarket'], ARRAY['toss', 'toss 1kg']),
  ('Ariel Washing Powder 500g', 'Washing Powder', 'Ariel', 500, 'g', 'unit', 'Household', ARRAY['duka', 'mini_supermarket'], ARRAY['ariel', 'ariel 500g']),
  ('Ariel Washing Powder 1kg', 'Washing Powder', 'Ariel', 1, 'kg', 'unit', 'Household', ARRAY['duka', 'mini_supermarket'], ARRAY['ariel', 'ariel 1kg']),
  ('Sunlight Washing Powder 500g', 'Washing Powder', 'Sunlight', 500, 'g', 'unit', 'Household', ARRAY['duka', 'mini_supermarket'], ARRAY['sunlight', 'sunlight 500g']),
  ('Sunlight Washing Powder 1kg', 'Washing Powder', 'Sunlight', 1, 'kg', 'unit', 'Household', ARRAY['duka', 'mini_supermarket'], ARRAY['sunlight', 'sunlight 1kg']),
  ('Persil Washing Powder 500g', 'Washing Powder', 'Persil', 500, 'g', 'unit', 'Household', ARRAY['duka', 'mini_supermarket'], ARRAY['persil', 'persil 500g']),
  ('Persil Washing Powder 1kg', 'Washing Powder', 'Persil', 1, 'kg', 'unit', 'Household', ARRAY['duka', 'mini_supermarket'], ARRAY['persil', 'persil 1kg']),
  ('Msafi Washing Powder 500g', 'Washing Powder', 'Msafi', 500, 'g', 'unit', 'Household', ARRAY['duka', 'mini_supermarket'], ARRAY['msafi', 'msafi 500g']),
  ('Msafi Washing Powder 1kg', 'Washing Powder', 'Msafi', 1, 'kg', 'unit', 'Household', ARRAY['duka', 'mini_supermarket'], ARRAY['msafi', 'msafi 1kg']),
  ('Ndume Bar Soap 800g', 'Bar Soap', 'Ndume', 800, 'g', 'unit', 'Household', ARRAY['duka', 'mini_supermarket'], ARRAY['ndume', 'ndume 800g']),
  ('Ndume Bar Soap 1kg', 'Bar Soap', 'Ndume', 1, 'kg', 'unit', 'Household', ARRAY['duka', 'mini_supermarket'], ARRAY['ndume', 'ndume 1kg']),
  ('White Star Bar Soap 800g', 'Bar Soap', 'White Star', 800, 'g', 'unit', 'Household', ARRAY['duka', 'mini_supermarket'], ARRAY['white star', 'white star 800g', 'whitestar']),
  ('White Star Bar Soap 1kg', 'Bar Soap', 'White Star', 1, 'kg', 'unit', 'Household', ARRAY['duka', 'mini_supermarket'], ARRAY['white star', 'white star 1kg', 'whitestar']),
  ('Menengai Bar Soap 800g', 'Bar Soap', 'Menengai', 800, 'g', 'unit', 'Household', ARRAY['duka', 'mini_supermarket'], ARRAY['menengai', 'menengai 800g']),
  ('Menengai Bar Soap 1kg', 'Bar Soap', 'Menengai', 1, 'kg', 'unit', 'Household', ARRAY['duka', 'mini_supermarket'], ARRAY['menengai', 'menengai 1kg']),
  ('Panga Bar Soap 800g', 'Bar Soap', 'Panga', 800, 'g', 'unit', 'Household', ARRAY['duka', 'mini_supermarket'], ARRAY['panga soap', 'panga soap 800g']),
  ('Panga Bar Soap 1kg', 'Bar Soap', 'Panga', 1, 'kg', 'unit', 'Household', ARRAY['duka', 'mini_supermarket'], ARRAY['panga soap', 'panga soap 1kg']),
  ('Jamaa Bar Soap 800g', 'Bar Soap', 'Jamaa', 800, 'g', 'unit', 'Household', ARRAY['duka', 'mini_supermarket'], ARRAY['jamaa', 'jamaa 800g']),
  ('Jamaa Bar Soap 1kg', 'Bar Soap', 'Jamaa', 1, 'kg', 'unit', 'Household', ARRAY['duka', 'mini_supermarket'], ARRAY['jamaa', 'jamaa 1kg']),
  ('Sunlight Bar Soap 800g', 'Bar Soap', 'Sunlight', 800, 'g', 'unit', 'Household', ARRAY['duka', 'mini_supermarket'], ARRAY['sunlight bar', 'sunlight bar 800g']),
  ('Sunlight Bar Soap 1kg', 'Bar Soap', 'Sunlight', 1, 'kg', 'unit', 'Household', ARRAY['duka', 'mini_supermarket'], ARRAY['sunlight bar', 'sunlight bar 1kg']),
  ('Vim Dishwashing Liquid 500ml', 'Dishwashing Liquid', 'Vim', 500, 'ml', 'unit', 'Household', ARRAY['duka', 'mini_supermarket'], ARRAY['vim', 'vim 500ml']),
  ('Sunlight Dishwashing Liquid 500ml', 'Dishwashing Liquid', 'Sunlight', 500, 'ml', 'unit', 'Household', ARRAY['duka', 'mini_supermarket'], ARRAY['sunlight liquid', 'sunlight liquid 500ml']),
  ('Morning Fresh Dishwashing Liquid 500ml', 'Dishwashing Liquid', 'Morning Fresh', 500, 'ml', 'unit', 'Household', ARRAY['duka', 'mini_supermarket'], ARRAY['morning fresh', 'morning fresh 500ml']),
  ('Jik Bleach 500ml', 'Bleach', 'Jik', 500, 'ml', 'unit', 'Household', ARRAY['duka', 'mini_supermarket'], ARRAY['jik', 'jik 500ml']),
  ('Jik Bleach 750ml', 'Bleach', 'Jik', 750, 'ml', 'unit', 'Household', ARRAY['duka', 'mini_supermarket'], ARRAY['jik', 'jik 750ml']),
  ('Zoom Bleach 500ml', 'Bleach', 'Zoom', 500, 'ml', 'unit', 'Household', ARRAY['duka', 'mini_supermarket'], ARRAY['zoom', 'zoom 500ml']),
  ('Zoom Bleach 750ml', 'Bleach', 'Zoom', 750, 'ml', 'unit', 'Household', ARRAY['duka', 'mini_supermarket'], ARRAY['zoom', 'zoom 750ml']),
  ('Tiger Matches', 'Matches', 'Tiger', NULL, NULL, 'unit', 'Household', ARRAY['duka', 'mini_supermarket'], ARRAY['tiger', 'tiger matches']),
  ('Colgate Toothpaste 50ml', 'Toothpaste', 'Colgate', 50, 'ml', 'unit', 'Personal care', ARRAY['duka', 'mini_supermarket'], ARRAY['colgate', 'colgate 50ml']),
  ('Colgate Toothpaste 100ml', 'Toothpaste', 'Colgate', 100, 'ml', 'unit', 'Personal care', ARRAY['duka', 'mini_supermarket'], ARRAY['colgate', 'colgate 100ml']),
  ('Close Up Toothpaste 50ml', 'Toothpaste', 'Close Up', 50, 'ml', 'unit', 'Personal care', ARRAY['duka', 'mini_supermarket'], ARRAY['close up', 'close up 50ml', 'closeup']),
  ('Close Up Toothpaste 100ml', 'Toothpaste', 'Close Up', 100, 'ml', 'unit', 'Personal care', ARRAY['duka', 'mini_supermarket'], ARRAY['close up', 'close up 100ml', 'closeup']),
  ('Whitedent Toothpaste 50ml', 'Toothpaste', 'Whitedent', 50, 'ml', 'unit', 'Personal care', ARRAY['duka', 'mini_supermarket'], ARRAY['whitedent', 'whitedent 50ml']),
  ('Whitedent Toothpaste 100ml', 'Toothpaste', 'Whitedent', 100, 'ml', 'unit', 'Personal care', ARRAY['duka', 'mini_supermarket'], ARRAY['whitedent', 'whitedent 100ml']),
  ('Aquafresh Toothpaste 50ml', 'Toothpaste', 'Aquafresh', 50, 'ml', 'unit', 'Personal care', ARRAY['duka', 'mini_supermarket'], ARRAY['aquafresh', 'aquafresh 50ml']),
  ('Aquafresh Toothpaste 100ml', 'Toothpaste', 'Aquafresh', 100, 'ml', 'unit', 'Personal care', ARRAY['duka', 'mini_supermarket'], ARRAY['aquafresh', 'aquafresh 100ml']),
  ('Vaseline Petroleum Jelly 100g', 'Petroleum Jelly', 'Vaseline', 100, 'g', 'unit', 'Personal care', ARRAY['beauty_shop', 'duka', 'mini_supermarket'], ARRAY['vaseline', 'vaseline 100g']),
  ('Vaseline Petroleum Jelly 250g', 'Petroleum Jelly', 'Vaseline', 250, 'g', 'unit', 'Personal care', ARRAY['beauty_shop', 'duka', 'mini_supermarket'], ARRAY['vaseline', 'vaseline 250g']),
  ('Arimis Petroleum Jelly 100g', 'Petroleum Jelly', 'Arimis', 100, 'g', 'unit', 'Personal care', ARRAY['beauty_shop', 'duka', 'mini_supermarket'], ARRAY['arimis', 'arimis 100g']),
  ('Arimis Petroleum Jelly 250g', 'Petroleum Jelly', 'Arimis', 250, 'g', 'unit', 'Personal care', ARRAY['beauty_shop', 'duka', 'mini_supermarket'], ARRAY['arimis', 'arimis 250g']),
  ('Movit Petroleum Jelly 100g', 'Petroleum Jelly', 'Movit', 100, 'g', 'unit', 'Personal care', ARRAY['beauty_shop', 'duka', 'mini_supermarket'], ARRAY['movit', 'movit 100g']),
  ('Movit Petroleum Jelly 250g', 'Petroleum Jelly', 'Movit', 250, 'g', 'unit', 'Personal care', ARRAY['beauty_shop', 'duka', 'mini_supermarket'], ARRAY['movit', 'movit 250g']),
  ('Nice and Lovely Body Lotion 200ml', 'Body Lotion', 'Nice and Lovely', 200, 'ml', 'unit', 'Personal care', ARRAY['beauty_shop', 'duka', 'mini_supermarket'], ARRAY['nice and lovely', 'nice and lovely 200ml', 'nice n lovely']),
  ('Nice and Lovely Body Lotion 400ml', 'Body Lotion', 'Nice and Lovely', 400, 'ml', 'unit', 'Personal care', ARRAY['beauty_shop', 'duka', 'mini_supermarket'], ARRAY['nice and lovely', 'nice and lovely 400ml', 'nice n lovely']),
  ('Movit Body Lotion 200ml', 'Body Lotion', 'Movit', 200, 'ml', 'unit', 'Personal care', ARRAY['beauty_shop', 'duka', 'mini_supermarket'], ARRAY['movit lotion', 'movit lotion 200ml']),
  ('Movit Body Lotion 400ml', 'Body Lotion', 'Movit', 400, 'ml', 'unit', 'Personal care', ARRAY['beauty_shop', 'duka', 'mini_supermarket'], ARRAY['movit lotion', 'movit lotion 400ml']),
  ('Dawn Body Lotion 200ml', 'Body Lotion', 'Dawn', 200, 'ml', 'unit', 'Personal care', ARRAY['beauty_shop', 'duka', 'mini_supermarket'], ARRAY['dawn', 'dawn 200ml']),
  ('Dawn Body Lotion 400ml', 'Body Lotion', 'Dawn', 400, 'ml', 'unit', 'Personal care', ARRAY['beauty_shop', 'duka', 'mini_supermarket'], ARRAY['dawn', 'dawn 400ml']),
  ('Geisha Bathing Soap', 'Bathing Soap', 'Geisha', NULL, NULL, 'unit', 'Personal care', ARRAY['duka', 'mini_supermarket'], ARRAY['geisha']),
  ('Imperial Leather Bathing Soap', 'Bathing Soap', 'Imperial Leather', NULL, NULL, 'unit', 'Personal care', ARRAY['duka', 'mini_supermarket'], ARRAY['imperial', 'imperial leather']),
  ('Lifebuoy Bathing Soap', 'Bathing Soap', 'Lifebuoy', NULL, NULL, 'unit', 'Personal care', ARRAY['duka', 'mini_supermarket'], ARRAY['lifebuoy']),
  ('Protex Bathing Soap', 'Bathing Soap', 'Protex', NULL, NULL, 'unit', 'Personal care', ARRAY['duka', 'mini_supermarket'], ARRAY['protex']),
  ('Dettol Bathing Soap', 'Bathing Soap', 'Dettol', NULL, NULL, 'unit', 'Personal care', ARRAY['duka', 'mini_supermarket'], ARRAY['dettol soap']),
  ('Always Sanitary Pads', 'Sanitary Pads', 'Always', NULL, NULL, 'unit', 'Personal care', ARRAY['duka', 'mini_supermarket', 'pharmacy'], ARRAY['always']),
  ('Kotex Sanitary Pads', 'Sanitary Pads', 'Kotex', NULL, NULL, 'unit', 'Personal care', ARRAY['duka', 'mini_supermarket', 'pharmacy'], ARRAY['kotex']),
  ('Sunny Girl Sanitary Pads', 'Sanitary Pads', 'Sunny Girl', NULL, NULL, 'unit', 'Personal care', ARRAY['duka', 'mini_supermarket', 'pharmacy'], ARRAY['sunny', 'sunny girl']),
  ('Pampers Baby Diapers', 'Baby Diapers', 'Pampers', NULL, NULL, 'unit', 'Baby', ARRAY['duka', 'mini_supermarket', 'pharmacy'], ARRAY['pampers']),
  ('Huggies Baby Diapers', 'Baby Diapers', 'Huggies', NULL, NULL, 'unit', 'Baby', ARRAY['duka', 'mini_supermarket', 'pharmacy'], ARRAY['huggies']),
  ('Softcare Baby Diapers', 'Baby Diapers', 'Softcare', NULL, NULL, 'unit', 'Baby', ARRAY['duka', 'mini_supermarket', 'pharmacy'], ARRAY['softcare']),
  ('Molfix Baby Diapers', 'Baby Diapers', 'Molfix', NULL, NULL, 'unit', 'Baby', ARRAY['duka', 'mini_supermarket', 'pharmacy'], ARRAY['molfix']),
  ('Cerelac 400g', 'Baby Cereal', 'Cerelac', 400, 'g', 'unit', 'Baby', ARRAY['duka', 'mini_supermarket', 'pharmacy'], ARRAY['cerelac', 'cerelac 400g']),
  ('Nan 400g', 'Baby Formula', 'Nan', 400, 'g', 'unit', 'Baby', ARRAY['duka', 'mini_supermarket', 'pharmacy'], ARRAY['nan', 'nan 400g', 'nan formula']),
  ('Panadol', 'Painkiller Tablets', 'Panadol', NULL, NULL, 'unit', 'Medicine', ARRAY['duka', 'mini_supermarket', 'pharmacy'], ARRAY['panadol']),
  ('Hedex', 'Painkiller Tablets', 'Hedex', NULL, NULL, 'unit', 'Medicine', ARRAY['duka', 'mini_supermarket', 'pharmacy'], ARRAY['hedex']),
  ('Mara Moja', 'Painkiller Tablets', 'Mara Moja', NULL, NULL, 'unit', 'Medicine', ARRAY['duka', 'mini_supermarket', 'pharmacy'], ARRAY['mara moja', 'maramoja']),
  ('Action', 'Painkiller Tablets', 'Action', NULL, NULL, 'unit', 'Medicine', ARRAY['duka', 'mini_supermarket', 'pharmacy'], ARRAY['action']),
  ('Brufen', 'Painkiller Tablets', 'Brufen', NULL, NULL, 'unit', 'Medicine', ARRAY['pharmacy'], ARRAY['brufen']),
  ('Bamburi Cement 50kg', 'Cement', 'Bamburi', 50, 'kg', 'unit', 'Building', ARRAY['hardware'], ARRAY['bamburi', 'bamburi 50kg']),
  ('Simba Cement 50kg', 'Cement', 'Simba', 50, 'kg', 'unit', 'Building', ARRAY['hardware'], ARRAY['simba', 'simba cement', 'simba cement 50kg']),
  ('Savannah Cement 50kg', 'Cement', 'Savannah', 50, 'kg', 'unit', 'Building', ARRAY['hardware'], ARRAY['savannah', 'savannah 50kg']),
  ('Nyumba Cement 50kg', 'Cement', 'Nyumba', 50, 'kg', 'unit', 'Building', ARRAY['hardware'], ARRAY['mombasa cement', 'nyumba', 'nyumba 50kg']),
  ('Rhino Cement 50kg', 'Cement', 'Rhino', 50, 'kg', 'unit', 'Building', ARRAY['hardware'], ARRAY['rhino', 'rhino 50kg']),
  ('Ndovu Cement 50kg', 'Cement', 'Ndovu', 50, 'kg', 'unit', 'Building', ARRAY['hardware'], ARRAY['ndovu cement', 'ndovu cement 50kg']),
  ('Britania Biscuits', 'Biscuits', 'Britania', NULL, NULL, 'unit', 'Snacks', ARRAY['duka', 'mini_supermarket'], ARRAY['britania']),
  ('Manji Biscuits', 'Biscuits', 'Manji', NULL, NULL, 'unit', 'Snacks', ARRAY['duka', 'mini_supermarket'], ARRAY['house of manji', 'manji']),
  ('Delmonte Juice 250ml', 'Juice', 'Delmonte', 250, 'ml', 'unit', 'Drinks', ARRAY['duka', 'mini_supermarket'], ARRAY['del monte', 'delmonte', 'delmonte 250ml']),
  ('Delmonte Juice 500ml', 'Juice', 'Delmonte', 500, 'ml', 'unit', 'Drinks', ARRAY['duka', 'mini_supermarket'], ARRAY['del monte', 'delmonte', 'delmonte 500ml']),
  ('Delmonte Juice 1L', 'Juice', 'Delmonte', 1, 'L', 'unit', 'Drinks', ARRAY['duka', 'mini_supermarket'], ARRAY['del monte', 'delmonte', 'delmonte 1L']),
  ('Pick n Peel Juice 250ml', 'Juice', 'Pick n Peel', 250, 'ml', 'unit', 'Drinks', ARRAY['duka', 'mini_supermarket'], ARRAY['pick and peel', 'pick n peel', 'pick n peel 250ml']),
  ('Pick n Peel Juice 500ml', 'Juice', 'Pick n Peel', 500, 'ml', 'unit', 'Drinks', ARRAY['duka', 'mini_supermarket'], ARRAY['pick and peel', 'pick n peel', 'pick n peel 500ml']),
  ('Pick n Peel Juice 1L', 'Juice', 'Pick n Peel', 1, 'L', 'unit', 'Drinks', ARRAY['duka', 'mini_supermarket'], ARRAY['pick and peel', 'pick n peel', 'pick n peel 1L']),
  ('Afia Juice 250ml', 'Juice', 'Afia', 250, 'ml', 'unit', 'Drinks', ARRAY['duka', 'mini_supermarket'], ARRAY['afia', 'afia 250ml']),
  ('Afia Juice 500ml', 'Juice', 'Afia', 500, 'ml', 'unit', 'Drinks', ARRAY['duka', 'mini_supermarket'], ARRAY['afia', 'afia 500ml']),
  ('Afia Juice 1L', 'Juice', 'Afia', 1, 'L', 'unit', 'Drinks', ARRAY['duka', 'mini_supermarket'], ARRAY['afia', 'afia 1L']),
  ('Quencher Juice 250ml', 'Juice', 'Quencher', 250, 'ml', 'unit', 'Drinks', ARRAY['duka', 'mini_supermarket'], ARRAY['quencher', 'quencher 250ml']),
  ('Quencher Juice 500ml', 'Juice', 'Quencher', 500, 'ml', 'unit', 'Drinks', ARRAY['duka', 'mini_supermarket'], ARRAY['quencher', 'quencher 500ml']),
  ('Quencher Juice 1L', 'Juice', 'Quencher', 1, 'L', 'unit', 'Drinks', ARRAY['duka', 'mini_supermarket'], ARRAY['quencher', 'quencher 1L']),
  ('Minute Maid Juice 250ml', 'Juice', 'Minute Maid', 250, 'ml', 'unit', 'Drinks', ARRAY['duka', 'mini_supermarket'], ARRAY['minute maid', 'minute maid 250ml']),
  ('Minute Maid Juice 500ml', 'Juice', 'Minute Maid', 500, 'ml', 'unit', 'Drinks', ARRAY['duka', 'mini_supermarket'], ARRAY['minute maid', 'minute maid 500ml']),
  ('Minute Maid Juice 1L', 'Juice', 'Minute Maid', 1, 'L', 'unit', 'Drinks', ARRAY['duka', 'mini_supermarket'], ARRAY['minute maid', 'minute maid 1L']),
  ('Aquamist Bottled Water 500ml', 'Bottled Water', 'Aquamist', 500, 'ml', 'unit', 'Drinks', ARRAY['duka', 'mini_supermarket'], ARRAY['aquamist', 'aquamist 500ml']),
  ('Aquamist Bottled Water 1L', 'Bottled Water', 'Aquamist', 1, 'L', 'unit', 'Drinks', ARRAY['duka', 'mini_supermarket'], ARRAY['aquamist', 'aquamist 1L']),
  ('Highlands Bottled Water 500ml', 'Bottled Water', 'Highlands', 500, 'ml', 'unit', 'Drinks', ARRAY['duka', 'mini_supermarket'], ARRAY['highlands', 'highlands 500ml']),
  ('Highlands Bottled Water 1L', 'Bottled Water', 'Highlands', 1, 'L', 'unit', 'Drinks', ARRAY['duka', 'mini_supermarket'], ARRAY['highlands', 'highlands 1L']),
  ('Eveready Batteries', 'Batteries', 'Eveready', NULL, NULL, 'unit', 'Other', ARRAY['duka', 'electronics', 'mini_supermarket'], ARRAY['eveready']),
  ('Tiger Head Batteries', 'Batteries', 'Tiger Head', NULL, NULL, 'unit', 'Other', ARRAY['duka', 'electronics', 'mini_supermarket'], ARRAY['tiger head'])
ON CONFLICT (name) DO UPDATE
  SET product_type   = EXCLUDED.product_type,
      brand          = EXCLUDED.brand,
      size_value     = EXCLUDED.size_value,
      size_unit      = EXCLUDED.size_unit,
      sold_by        = EXCLUDED.sold_by,
      category       = EXCLUDED.category,
      business_types = EXCLUDED.business_types,
      aliases        = EXCLUDED.aliases;

-- Brand names sitting in the generic rows' aliases, from before any brand row
-- existed. They now outrank the real thing: typing "tusker" put the plain
-- "Beer 500ml" above Tusker Lager, because the generic claimed the word.
-- Removed one alias at a time rather than by rewriting the array, so the rest
-- of each row's vocabulary is left exactly as it is.

UPDATE public.canonical_products SET aliases = array_remove(aliases, 'kimbo')
WHERE name = 'Cooking Fat 500g';
UPDATE public.canonical_products SET aliases = array_remove(aliases, 'blue band')
WHERE name = 'Margarine 250g';
UPDATE public.canonical_products SET aliases = array_remove(aliases, 'power play')
WHERE name = 'Energy Drink 300ml';
UPDATE public.canonical_products SET aliases = array_remove(array_remove(aliases, 'pilsner'), 'tusker')
WHERE name = 'Beer 500ml';
UPDATE public.canonical_products SET aliases = array_remove(aliases, 'snapp')
WHERE name = 'Cider 500ml';
UPDATE public.canonical_products SET aliases = array_remove(aliases, 'senator')
WHERE name = 'Keg Beer';
UPDATE public.canonical_products SET aliases = array_remove(aliases, 'omo')
WHERE name = 'Washing Powder 500g';
UPDATE public.canonical_products SET aliases = array_remove(aliases, 'omo 1kg')
WHERE name = 'Washing Powder 1kg';
UPDATE public.canonical_products SET aliases = array_remove(aliases, 'jik')
WHERE name = 'Bleach 500ml';
UPDATE public.canonical_products SET aliases = array_remove(aliases, 'jik 750ml')
WHERE name = 'Bleach 750ml';
UPDATE public.canonical_products SET aliases = array_remove(aliases, 'colgate')
WHERE name = 'Toothpaste 100ml';
UPDATE public.canonical_products SET aliases = array_remove(aliases, 'vaseline')
WHERE name = 'Petroleum Jelly 100g';
UPDATE public.canonical_products SET aliases = array_remove(aliases, 'vaseline 250g')
WHERE name = 'Petroleum Jelly 250g';
UPDATE public.canonical_products SET aliases = array_remove(aliases, 'geisha')
WHERE name = 'Bathing Soap';
UPDATE public.canonical_products SET aliases = array_remove(aliases, 'pampers')
WHERE name = 'Baby Diapers Small Pack';
UPDATE public.canonical_products SET aliases = array_remove(aliases, 'cerelac')
WHERE name = 'Baby Cereal 400g';
UPDATE public.canonical_products SET aliases = array_remove(aliases, 'panadol')
WHERE name = 'Paracetamol Tablets';
UPDATE public.canonical_products SET aliases = array_remove(aliases, 'brufen')
WHERE name = 'Ibuprofen Tablets';
