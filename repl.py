import pickle, pathlib

p = pathlib.Path('service_protocol_graph.gpickle')
print('exists', p.exists())
print('size', p.stat().st_size if p.exists() else None)

if p.exists():
    with open('service_protocol_graph.gpickle', 'rb') as fh:
        G = pickle.load(fh)
    print('nodes', G.number_of_nodes(), 'edges', G.number_of_edges())
    print('sample', list(G.nodes())[:10])
